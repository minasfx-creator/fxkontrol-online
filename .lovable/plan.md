## Multi-Transport por Dispositivo

Hoje cada transport (Web Serial, WebUSB, WebBLE, Art-Net) gera um `DiscoveredDevice` independente — o mesmo controlador físico aparece como 2-3 entradas distintas. Vou unificar isso introduzindo uma **identidade lógica** (`PhysicalDevice`) que agrega todos os links observados e permite escolher o transporte ativo com fallback.

---

### O que muda para o usuário

- A página `/dev/real-discovery` e o `EasyConnectPanel` passam a mostrar **um card por dispositivo físico**, com chips "Serial / USB / BLE / Art-Net" indicando todos os transports disponíveis para aquele aparelho.
- O usuário pode clicar em um chip para fixar o transport preferido (ex: "usar Web Serial neste FXcommander, não BLE").
- Se o transport ativo cair (cabo desconectado, BLE fora de alcance), o sistema **promove automaticamente** o próximo transport saudável e registra o evento — sem perder a sessão.

---

### Arquitetura

```text
┌───────────────────────────────────────────────────────────────┐
│  TransportDiscoverers (já existem — sem mudança)              │
│  webserial · webusb · webble · mdns-artnet · capacitorSerial  │
└────────────────┬──────────────────────────────────────────────┘
                 │ DiscoveryEvent (1 por link físico)
                 ▼
┌───────────────────────────────────────────────────────────────┐
│  UnifiedDiscoveryService (existe — alimenta o agregador)      │
└────────────────┬──────────────────────────────────────────────┘
                 │
                 ▼
┌───────────────────────────────────────────────────────────────┐
│  DeviceAggregator  (NOVO)                                     │
│  • aggregateKey(device) → "vid:pid:serial" ou "host:..."      │
│  • Map<aggregateKey, PhysicalDevice>                          │
│  • PhysicalDevice.links: Record<Transport, DiscoveredDevice>  │
│  • activeTransport + preferredTransport                       │
│  • promoteOnLoss() → escolhe próximo link online              │
└────────────────┬──────────────────────────────────────────────┘
                 │ PhysicalDeviceEvent (added / link-added /
                 │   link-lost / promoted / removed)
                 ▼
        UI: RealDiscoveryProbe, EasyConnectPanel
```

---

### Detalhes técnicos

**1. `src/core/discovery/aggregateKey.ts` (novo)**
- Função `aggregateKey({ vendorId, productId, serialNumber, host, bleAddress }): string` que gera uma chave canônica cross-transport:
  - USB/Serial com `serialNumber`: `phys:vid:pid:serial`
  - USB/Serial sem serial: `phys:vid:pid` (mesma família vira mesmo dispositivo — comportamento legado preservado)
  - BLE: `phys:ble:${bleAddress || name}`
  - Art-Net: `phys:host:${ip}`
- Função `linksMatch(a, b)`: heurística pra unificar serial+USB do mesmo cabo (mesmo VID:PID, ambos online em <2s) — necessária porque o mesmo CH340 aparece como WebSerial e WebUSB.

**2. `src/core/discovery/types.ts` (estender)**
- Novo tipo `PhysicalDevice`:
  ```ts
  interface PhysicalDevice {
    aggregateId: string;
    label: string;
    vendorId?: number; productId?: number;
    serialNumber?: string;
    links: Partial<Record<DiscoveryTransport, DiscoveredDevice>>;
    activeTransport: DiscoveryTransport | null;
    preferredTransport: DiscoveryTransport | null;
    online: boolean;
    firstSeen: number; lastSeen: number;
  }
  type PhysicalDeviceEvent =
    | { type: 'added'; device: PhysicalDevice }
    | { type: 'link-added'; device: PhysicalDevice; transport: DiscoveryTransport }
    | { type: 'link-lost'; device: PhysicalDevice; transport: DiscoveryTransport }
    | { type: 'promoted'; device: PhysicalDevice; from: DiscoveryTransport | null; to: DiscoveryTransport }
    | { type: 'removed'; device: PhysicalDevice };
  ```

**3. `src/core/discovery/DeviceAggregator.ts` (novo)**
- Singleton `deviceAggregator` que se subscreve em `unifiedDiscovery.watch()`.
- Transport priority default: `webserial > webusb > webble > mdns-artnet` (serial é mais determinístico p/ DMX/PBUS).
- `setPreferredTransport(aggregateId, transport)` persistido em `portRegistry` via novo campo `preferredTransport`.
- `promoteOnLoss()`: quando `link-lost` deixa o `activeTransport` offline, escolhe o próximo link online seguindo a prioridade (respeitando preferência se ainda online).
- API pública: `getDevices()`, `getDevice(id)`, `watch(fn)`, `setPreferredTransport()`.

**4. `src/core/discovery/portRegistry.ts` (estender)**
- Adicionar `preferredTransport?: DiscoveryTransport` em `PortRegistryEntry`.
- Métodos `setPreferredTransport(key, t)` / `getPreferredTransport(key)` — chave é a mesma `keyFor()` existente.

**5. `src/pages/RealDiscoveryProbe.tsx` (atualizar)**
- Substituir lista plana de devices por lista de `PhysicalDevice`.
- Cada card mostra:
  - Label + VID/PID/serial
  - Chips dos transports presentes (ativo destacado em ciano, demais em cinza)
  - Click no chip → `setPreferredTransport()`
  - Indicador "Promoted from X to Y" quando ocorre fallback
- Adicionar contador "N físico(s) · M link(s)" no header.

**6. `src/components/editor/EasyConnectPanel.tsx` (ajuste leve)**
- Trocar `unifiedDiscovery.getDevices()` por `deviceAggregator.getDevices()` e renderizar 1 entrada por dispositivo físico, listando os transports como sub-itens.
- Preservar todo o fluxo de autorização atual — apenas a deduplicação muda.

**7. Memória**
- Criar `mem://funcionalidades/multi-transport-aggregation.md` documentando aggregateKey, PhysicalDevice, prioridade de transport, fallback automático e persistência de preferredTransport.

---

### Compatibilidade

- `UnifiedDiscoveryService`, `portRegistry.recordSuccess`, hot-plug e o gate `realOnlyMode` permanecem **inalterados** — o aggregator é uma camada acima, não substitui nada.
- Pontos do código que ainda querem o stream cru continuam usando `unifiedDiscovery.watch()` direto (zero breaking changes em hooks e adapters existentes).
- A heurística serial+USB de mesmo cabo é conservadora: se em dúvida, mantém entradas separadas (falso negativo > falso positivo).

---

### Arquivos

**Criar**
- `src/core/discovery/aggregateKey.ts`
- `src/core/discovery/DeviceAggregator.ts`

**Editar**
- `src/core/discovery/types.ts` — adicionar `PhysicalDevice`, `PhysicalDeviceEvent`
- `src/core/discovery/portRegistry.ts` — adicionar `preferredTransport` + getters/setters
- `src/pages/RealDiscoveryProbe.tsx` — UI por dispositivo físico, chips de transport, fallback visível
- `src/components/editor/EasyConnectPanel.tsx` — consumir aggregator
- `mem://index.md` + `mem://funcionalidades/multi-transport-aggregation.md`
