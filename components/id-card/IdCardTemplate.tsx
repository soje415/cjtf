import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'

const C = {
  green:  '#008751',
  gold:   '#FFD700',
  white:  '#ffffff',
  black:  '#1a1a1a',
  grey:   '#5a5a5a',
  red:    '#CC0000',
  yellow: '#FFD700',
  // CJTF flag colours — the card's left stripe, sampled from the official flag artwork.
  flagBlue:   '#0FB3E3',
  flagYellow: '#FDF110',
  flagRed:    '#EE3034',
}

// CR80: 85.6 mm × 54 mm ≈ 242 pt × 153 pt
const W = 242
const H = 153

const STRIPE_W = 10   // left colour stripe total width (pt)
const MAIN_W   = W - STRIPE_W

const styles = StyleSheet.create({
  page: { width: W, height: H, backgroundColor: C.white, flexDirection: 'row', padding: 0 },

  // ── Left colour stripe ──
  stripe:       { width: STRIPE_W, height: H, flexDirection: 'row' },
  stripeBlue:   { flex: 1, backgroundColor: C.flagBlue },
  stripeYellow: { flex: 1, backgroundColor: C.flagYellow },
  stripeRed:    { flex: 1, backgroundColor: C.flagRed },

  // ── Main column ──
  main: { width: MAIN_W, height: H, flexDirection: 'column' },

  // Header (black band)
  header: {
    height: 34,
    backgroundColor: C.black,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 5,
  },
  logoBadge: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#3a3a3a',
    borderWidth: 1, borderColor: C.gold, borderStyle: 'solid',
    alignItems: 'center', justifyContent: 'center',
  },
  logoImg:   { width: 20, height: 20, borderRadius: 10 },
  logoFallback: { fontSize: 5, fontWeight: 'bold', color: C.white },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 7, fontWeight: 'bold', color: C.white, letterSpacing: 0.5 },
  headerSub:   { fontSize: 4, color: C.gold, marginTop: 2 },
  headerTag: {
    fontSize: 4, fontWeight: 'bold', color: C.green,
    backgroundColor: C.white, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2,
  },

  // Body
  body: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
    backgroundColor: C.white,
  },

  // Photo
  photoCol:   { width: 46, alignItems: 'center', paddingTop: 2 },
  photo: {
    width: 42, height: 52,
    objectFit: 'cover',
    borderWidth: 1.5, borderColor: C.green, borderStyle: 'solid', borderRadius: 1,
  },
  photoPlaceholder: {
    width: 42, height: 52, backgroundColor: '#e0e0e0',
    borderWidth: 1.5, borderColor: C.green, borderStyle: 'solid', borderRadius: 1,
  },

  // Details
  detailsCol: { flex: 1, justifyContent: 'center' },
  fullName:   { fontSize: 8, fontWeight: 'bold', color: C.black, marginBottom: 1 },
  cjtfId:     { fontSize: 6.5, fontWeight: 'bold', color: C.green, letterSpacing: 0.3, marginBottom: 3 },
  rankLabel:  { fontSize: 3.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.5 },
  rankValue:  { fontSize: 6.5, fontWeight: 'bold', color: C.green, marginTop: 1, marginBottom: 4 },
  row:   { flexDirection: 'row', gap: 6, marginBottom: 2 },
  field: { flex: 1 },
  fLabel: { fontSize: 3.5, color: C.grey, textTransform: 'uppercase', letterSpacing: 0.3 },
  fValue: { fontSize: 5, fontWeight: 'bold', color: C.black, marginTop: 0.5 },

  // QR
  qrCol:   { width: 38, alignItems: 'center', justifyContent: 'center', gap: 2 },
  qr:      { width: 34, height: 34 },
  qrLabel: { fontSize: 3.5, color: C.grey, textAlign: 'center' },

  // Footer (green band)
  footer: {
    height: 14,
    backgroundColor: C.green,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  footerLeft:  { fontSize: 3.5, color: C.white },
  footerRight: { fontSize: 3.5, color: C.gold },

  // Bottom black stripe
  bottomStripe: { height: 5, backgroundColor: C.black },
})

export interface IdCardData {
  fullName: string
  cjtfId: string
  residentialAddress: string
  lga: string
  gender: string
  nin?: string
  designation?: string
  photoUrl: string
  qrDataUrl: string
  issueDate: string
  expiryDate?: string
  logoBase64?: string
}

export default function IdCardTemplate({
  fullName, cjtfId, residentialAddress, lga, gender, nin,
  designation = 'VOLUNTEER MEMBER',
  photoUrl, qrDataUrl, issueDate, expiryDate, logoBase64,
}: IdCardData) {
  return (
    <Document>
      <Page size={{ width: W, height: H }} style={styles.page}>

        {/* ── LEFT COLOUR STRIPE ── */}
        <View style={styles.stripe}>
          <View style={styles.stripeBlue} />
          <View style={styles.stripeYellow} />
          <View style={styles.stripeRed} />
        </View>

        {/* ── MAIN COLUMN ── */}
        <View style={styles.main}>

          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              {logoBase64
                ? <Image src={logoBase64} style={styles.logoImg} />
                : <Text style={styles.logoFallback}>CJTF</Text>}
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>CIVILIAN JOINT TASK FORCE</Text>
              <Text style={styles.headerSub}>Official Identification Card — Federal Republic of Nigeria</Text>
            </View>
            <Text style={styles.headerTag}>CJTF</Text>
          </View>

          {/* BODY */}
          <View style={styles.body}>

            {/* Photo */}
            <View style={styles.photoCol}>
              {photoUrl
                ? <Image src={photoUrl} style={styles.photo} />
                : <View style={styles.photoPlaceholder} />}
            </View>

            {/* Details */}
            <View style={styles.detailsCol}>
              <Text style={styles.fullName}>{fullName}</Text>
              <Text style={styles.cjtfId}>{cjtfId}</Text>

              <Text style={styles.rankLabel}>Rank</Text>
              <Text style={styles.rankValue}>{designation}</Text>

              <View style={styles.row}>
                <View style={styles.field}>
                  <Text style={styles.fLabel}>Gender</Text>
                  <Text style={styles.fValue}>{gender ? gender.charAt(0).toUpperCase() + gender.slice(1) : '—'}</Text>
                </View>
                <View style={styles.field}>
                  <Text style={styles.fLabel}>LGA</Text>
                  <Text style={styles.fValue}>{lga}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.field}>
                  <Text style={styles.fLabel}>Address</Text>
                  <Text style={styles.fValue}>{residentialAddress}</Text>
                </View>
              </View>

              <View style={styles.row}>
                {nin && (
                  <View style={styles.field}>
                    <Text style={styles.fLabel}>NIN</Text>
                    <Text style={styles.fValue}>{nin}</Text>
                  </View>
                )}
                <View style={styles.field}>
                  <Text style={styles.fLabel}>Issue Date</Text>
                  <Text style={styles.fValue}>{issueDate}</Text>
                </View>
                {expiryDate && (
                  <View style={styles.field}>
                    <Text style={styles.fLabel}>Expiry Date</Text>
                    <Text style={styles.fValue}>{expiryDate}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* QR */}
            <View style={styles.qrCol}>
              {qrDataUrl ? <Image src={qrDataUrl} style={styles.qr} /> : null}
              <Text style={styles.qrLabel}>{'Scan to\nVerify'}</Text>
            </View>

          </View>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>This card is the property of CJTF Nigeria. If found, return to nearest CJTF office.</Text>
            <Text style={styles.footerRight}>www.cjtf.gov.ng</Text>
          </View>

          {/* BOTTOM STRIPE */}
          <View style={styles.bottomStripe} />

        </View>
      </Page>
    </Document>
  )
}
