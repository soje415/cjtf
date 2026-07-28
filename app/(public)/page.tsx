import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'

const steps = [
  { num: '01', title: 'Register & Apply', desc: 'Create your account and fill out the online application form with your personal details and documents.' },
  { num: '02', title: 'Pay Fees', desc: 'Pay the ID Card fee and Training fee securely via Paystack (card, transfer, or USSD).' },
  { num: '03', title: 'ICT Verification', desc: 'Your data is reviewed and verified by the ICT department.' },
  { num: '04', title: 'Intelligence Screening', desc: 'The Intelligence unit conducts background screening on your application.' },
  { num: '05', title: 'Admin Approval', desc: 'Final approval is granted by the Admin/Command office.' },
  { num: '06', title: 'Receive ID Card', desc: 'Download and print your official CJTF ID Card with QR verification code.' },
]

const STRIPE_COLORS = ['bg-cjtf-blue', 'bg-cjtf-yellow', 'bg-cjtf-red']
const BORDER_COLORS = ['border-l-cjtf-blue', 'border-l-cjtf-yellow', 'border-l-cjtf-red']
const TEXT_COLORS = ['text-cjtf-blue', 'text-cjtf-yellow', 'text-cjtf-red']

export default function HomePage() {
  return (
    <>
      {/* Colour stripe */}
      <div className="h-2 flex">
        {STRIPE_COLORS.map((c) => <div key={c} className={`flex-1 ${c}`} />)}
      </div>

      {/* Hero */}
      <section className="bg-cjtf-blue text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <Image
              src="/cjtf-logo.jpg"
              alt="CJTF Nigeria"
              width={110}
              height={110}
              className="rounded-full border-4 border-cjtf-yellow shadow-xl"
            />
          </div>
          <div className="inline-block bg-cjtf-yellow text-gray-900 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Official Portal 2026
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            CJTF Recruitment<br />Online Portal
          </h1>
          <p className="text-blue-100 text-lg mb-8 max-w-2xl mx-auto">
            Join the Civilian Joint Task Force. Apply online, complete verification, and receive your official ID card — all in one secure platform.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <LinkButton href="/auth/register" size="lg" className="bg-cjtf-yellow text-gray-900 font-bold hover:bg-cjtf-yellow-dark">
              Start Your Application
            </LinkButton>
            <LinkButton href="/auth/login" size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              Track My Application
            </LinkButton>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">How It Works</h2>
          <p className="text-gray-500 text-center mb-10">Six simple steps from application to ID card</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {steps.map((s, i) => (
              <Card key={s.num} className={`border-l-4 ${BORDER_COLORS[i % 3]}`}>
                <CardContent className="p-5">
                  <span className={`text-3xl font-bold opacity-20 ${TEXT_COLORS[i % 3]}`}>{s.num}</span>
                  <h3 className="font-semibold text-gray-800 mt-1 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Office Registration CTA */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Registering a CJTF Office?</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-xl mx-auto">
            Commanders and unit heads can request an Operational Permit to open a CJTF office in their
            area council, subject to Intelligence and Command review.
          </p>
          <LinkButton href="/portal/applicant/office" size="lg" variant="outline" className="border-cjtf-green text-cjtf-green hover:bg-cjtf-green-light">
            Register an Office &rarr;
          </LinkButton>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 px-4 text-center" style={{ background: 'linear-gradient(135deg, #09ADE2 0%, #0790BC 100%)' }}>
        <h2 className="text-xl font-bold text-white mb-2">Ready to Apply?</h2>
        <p className="text-blue-100 mb-6 text-sm">Registration is open. Apply today and begin your service.</p>
        <LinkButton href="/auth/register" className="bg-cjtf-yellow text-gray-900 font-bold hover:bg-cjtf-yellow-dark">
          Apply Now &rarr;
        </LinkButton>
      </section>

      {/* Footer stripe */}
      <div className="h-2 flex">
        {STRIPE_COLORS.map((c) => <div key={c} className={`flex-1 ${c}`} />)}
      </div>
    </>
  )
}
