/**
 * Re-export tipográfico canônico.
 *
 * Importe SEMPRE daqui em código novo:
 *   import { Timecode, DmxAddr, IpAddr, LogPane } from '@/components/typography';
 *
 * Garante que a fonte mono (JetBrains Mono) só apareça nos 4 contextos
 * permitidos pela regra de campo: timecode, DMX, IP, log panes.
 *
 * Para QUALQUER outro texto técnico curto (BPM, latência ms, RSSI),
 * use a className utilitária `.ds-mono` diretamente — é equivalente, mas
 * sem validação de formato.
 */
export { Timecode, DmxAddr, IpAddr, LogPane } from './TechnicalText';
