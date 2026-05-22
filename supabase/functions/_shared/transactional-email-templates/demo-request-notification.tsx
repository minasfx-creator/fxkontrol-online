import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'FX KONTROL'

interface Props {
  name?: string
  email?: string
  company?: string
  role?: string
  phone?: string
  packageInterest?: string
  currentStack?: string
  showScale?: string
  message?: string
  evidenceCount?: number
  requestId?: string
}

const Email = ({
  name = '—',
  email = '—',
  company = '—',
  role = '—',
  phone = '—',
  packageInterest = '—',
  currentStack = '—',
  showScale = '—',
  message = '—',
  evidenceCount = 0,
  requestId = '—',
}: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Nova solicitação de demo — {company}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nova solicitação de demo</Heading>
        <Text style={muted}>{SITE_NAME} • {packageInterest}</Text>

        <Section style={card}>
          <Row label="Empresa" value={company} />
          <Row label="Contato" value={`${name} · ${role}`} />
          <Row label="E-mail" value={email} />
          <Row label="Telefone" value={phone} />
          <Row label="Pacote" value={packageInterest} />
          <Row label="Escala do show" value={showScale} />
          <Row label="Stack atual" value={currentStack} />
          <Row label="Anexos" value={`${evidenceCount} arquivo(s)`} />
          <Row label="ID" value={requestId} />
        </Section>

        <Hr style={hr} />

        <Heading as="h2" style={h2}>Mensagem</Heading>
        <Text style={text}>{message}</Text>

        <Hr style={hr} />
        <Text style={footer}>
          Anexos disponíveis no bucket privado <code>demo-evidence</code>.
          Acesse pelo painel administrativo para download.
        </Text>
      </Container>
    </Body>
  </Html>
)

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={row}>
    <span style={rowLabel}>{label}</span>
    <span style={rowValue}>{value}</span>
  </Text>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `[FX KONTROL] Demo: ${d.company ?? '—'} (${d.packageInterest ?? '—'})`,
  displayName: 'Notificação interna de demo',
  to: 'vendas@fxkontrol.online',
  previewData: {
    name: 'Maria Silva',
    email: 'maria@produtoraexemplo.com',
    company: 'Produtora Exemplo',
    role: 'Diretora técnica',
    phone: '+55 31 99999-0000',
    packageInterest: 'LiveOps',
    currentStack: 'Finale 3D + FXK16 + Art-Net',
    showScale: '500 cues / 12 controllers',
    message: 'Queremos avaliar para um show outdoor de 30k pessoas em outubro.',
    evidenceCount: 3,
    requestId: 'abc-123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '640px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 4px' }
const h2 = { fontSize: '14px', fontWeight: 'bold', color: '#0a0a0a', margin: '24px 0 8px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const muted = { fontSize: '12px', color: '#6b7280', margin: '0 0 20px', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const card = { backgroundColor: '#f8fafc', borderRadius: '6px', padding: '16px 18px', border: '1px solid #e5e7eb' }
const row = { fontSize: '13px', color: '#0a0a0a', margin: '0 0 8px', display: 'flex', justifyContent: 'space-between' as const, gap: '12px' }
const rowLabel = { color: '#6b7280', minWidth: '120px', fontWeight: 600 as const }
const rowValue = { color: '#0a0a0a', textAlign: 'right' as const, flex: '1' }
const text = { fontSize: '14px', color: '#0a0a0a', lineHeight: '1.55', margin: '0 0 16px', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '8px 0 0' }
