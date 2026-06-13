import QRCode from 'qrcode'

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 150,
    margin: 1,
    color: { dark: '#000000', light: '#ffffff' },
  })
}
