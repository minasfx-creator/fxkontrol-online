import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'FX KONTROL'

interface Props {
  name?: string
  packageInterest?: string
  company?: string
}

const Email = ({ name, packageInterest, company }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Recebemos sua solicitação de demo do {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {name ? `Obrigado, ${name}!` : 'Obrigado pelo contato!'}
        </Heading>
        <Text style={text}>
          Recebemos sua solicitação de demo
          {packageInterest ? <> do pacote <strong>{packageInterest}</strong></> : null}
          {company ? <> em nome de <strong>{company}</strong></> : null}.
        </Text>
        <Text style={text}>
          Nosso time técnico vai revisar sua stack atual e as evidências enviadas.
          Em até <strong>1 dia útil</strong> entraremos em contato para agendar
          uma demo guiada de 15 minutos.
        </Text>

        <Section style={card}>
          <Text style={cardTitle}>O que esperar da demo:</Text>
          <Text style={cardItem}>• Setup ao vivo com seu stack real (DMX, drones, pirotecnia)</Text>
          <Text style={cardItem}>• Fluxo Go-Live Center com checklist GO/NO-GO</Text>
          <Text style={cardItem}>• Black box de auditoria + ESTOP {'<'}50ms</Text>
          <Text style={cardItem}>• Relatório técnico pós-demo</Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>
          Codificar imaginação; garantir precisão.<br />
          Equipe {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Recebemos sua solicitação de demo — FX KONTROL',
  displayName: 'Confirmação de solicitação de demo',
  previewData: {
    name: 'Maria',
    packageInterest: 'LiveOps',
    company: 'Produtora Exemplo',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold', color: '#0a0a0a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = { backgroundColor: '#f8fafc', borderRadius: '6px', padding: '16px 18px', border: '1px solid #e5e7eb', margin: '20px 0' }
const cardTitle = { fontSize: '13px', color: '#0a0a0a', fontWeight: 'bold' as const, margin: '0 0 8px' }
const cardItem = { fontSize: '13px', color: '#374151', margin: '4px 0' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#6b7280', margin: '8px 0 0', lineHeight: '1.6' }
