import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import IdCardTemplate, { type IdCardData } from '@/components/id-card/IdCardTemplate'

export type { IdCardData }

export async function generateIdCardPdf(data: IdCardData): Promise<Buffer> {
  const element = createElement(IdCardTemplate, data)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(element as any)
  return Buffer.from(buffer)
}
