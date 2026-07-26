import { Card, CardContent } from '@/components/ui/card'
import { LinkButton } from '@/components/ui/link-button'

export const metadata = {
  title: 'About | Civilian Joint Task Force — FCT Command Headquarters',
  description:
    'The Civilian Joint Task Force (CJTF) FCT Command Headquarters — community stabilization and local intelligence auxiliary securing the six Area Councils of the Federal Capital Territory.',
}

const STRIPE_COLORS = ['bg-cjtf-blue', 'bg-cjtf-yellow', 'bg-cjtf-red']
const BORDER_COLORS = ['border-l-cjtf-blue', 'border-l-cjtf-yellow', 'border-l-cjtf-red']
const TEXT_COLORS = ['text-cjtf-blue', 'text-cjtf-yellow', 'text-cjtf-red']

const pillars = [
  {
    title: 'Local Intelligence & Asymmetric Surveillance',
    desc: 'The primary strength of the CJTF lies in its grassroots composition. Unlike conventional forces, our operators live within the communities they protect — sustaining a persistent, low-visibility intelligence network capable of identifying criminal safehouses, mapping shift patterns in peripheral forests, and exposing transit vectors, including subterranean and unconventional exit routes, used by syndicates.',
  },
  {
    title: 'Tactical Joint Operations & Containment',
    desc: 'The CJTF FCT Command operates in direct lockstep with the FCT Police Command and military elements. Our personnel routinely provide logistical, terrain-guide, and frontline tracking support during high-velocity sweep operations to flush out bandit enclaves along the broken northern ridges, Kuje forest borders, and outer state frontiers.',
  },
  {
    title: 'Rigorous Vetting & Institutional Integrity',
    desc: 'To prevent criminal infiltration and maintain elite operational standards, the FCT Command Headquarters maintains a centralized biometric and documentation framework. Every operative undergoes rigorous physical and background clearing in coordination with state intelligence commands — requiring mandatory guarantor sign-offs from traditional rulers and community leadership to enforce lifelong institutional accountability.',
  },
  {
    title: 'Critical Infrastructure & Border Security',
    desc: 'Beyond urban policing, the CJTF fields dedicated units assigned to monitor vulnerable agricultural outposts, remote border junctions, and critical mining sectors across the Area Councils. By deterring informal rogue economies and securing farming communities, we actively protect the baseline economic security of the federal capital.',
  },
]

export default function AboutPage() {
  return (
    <>
      {/* Colour stripe */}
      <div className="h-2 flex">
        {STRIPE_COLORS.map((c) => <div key={c} className={`flex-1 ${c}`} />)}
      </div>

      {/* Hero */}
      <section className="bg-cjtf-blue text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block bg-cjtf-yellow text-gray-900 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            FCT Command Headquarters
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight">
            About the Civilian Joint Task Force
          </h1>
          <p className="text-blue-100 text-lg max-w-2xl mx-auto">
            A community-stabilization and local-intelligence auxiliary securing the six Area
            Councils of the Federal Capital Territory.
          </p>
        </div>
      </section>

      {/* Overview */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-3xl mx-auto space-y-5 text-gray-600 leading-relaxed">
          <p>
            The Civilian Joint Task Force (CJTF) FCT Command Headquarters serves as the primary
            community-stabilization and local intelligence auxiliary operating across the six Area
            Councils of the Federal Capital Territory. Born out of a strategic necessity to counter
            asymmetric threats, rural banditry, and suburban criminal networks, the CJTF bridges the
            critical operational gap between formal state security architectures — such as the
            Nigeria Police Force (NPF) and the Department of State Services (DSS) — and the diverse
            grassroots communities of Abuja.
          </p>
          <p>
            Operating under a unified command structure, our personnel leverage deep geographical
            familiarity and community trust to eliminate blind spots in peripheral terrains, forest
            boundaries, and high-density urban transit nodes.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="px-4 pb-14 bg-white">
        <div className="max-w-3xl mx-auto">
          <Card className="border-l-4 border-l-cjtf-yellow bg-cjtf-blue/5">
            <CardContent className="p-6">
              <h2 className="text-sm font-bold uppercase tracking-wide text-cjtf-blue mb-2">
                Our Mission
              </h2>
              <p className="text-gray-700 leading-relaxed">
                To secure the Federal Capital Territory through rigorous localized surveillance,
                robust joint operations with statutory security agencies, and the enforcement of
                absolute community accountability — ensuring Abuja remains an unyielding fortress
                against crime and terror.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Core Operational Pillars */}
      <section className="py-14 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">
            Core Operational Pillars
          </h2>
          <p className="text-gray-500 text-center mb-10">
            How the CJTF delivers security across the Area Councils
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pillars.map((p, i) => (
              <Card key={p.title} className={`border-l-4 ${BORDER_COLORS[i % 3]}`}>
                <CardContent className="p-6">
                  <span className={`text-3xl font-bold opacity-20 ${TEXT_COLORS[i % 3]}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <h3 className="font-semibold text-gray-800 mt-1 mb-2">{p.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{p.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Inter-Agency Alignment */}
      <section className="py-14 px-4 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold mb-4 text-gray-800">Inter-Agency Alignment</h2>
          <p className="text-gray-600 leading-relaxed">
            The CJTF FCT Command Headquarters operates in absolute submission to constitutional
            authority and the directives of the Federal Capital Territory Administration (FCTA). By
            integrating community vigilance with statutory military and paramilitary tactical
            backing, we ensure a seamless, multi-tiered response grid capable of neutralising modern
            security threats before they cross into the city center.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section
        className="py-12 px-4 text-center"
        style={{ background: 'linear-gradient(135deg, #09ADE2 0%, #0790BC 100%)' }}
      >
        <h2 className="text-xl font-bold text-white mb-2">Join the Force</h2>
        <p className="text-blue-100 mb-6 text-sm">
          Apply online, complete verification, and receive your official CJTF ID card.
        </p>
        <LinkButton
          href="/auth/register"
          className="bg-cjtf-yellow text-gray-900 font-bold hover:bg-cjtf-yellow-dark"
        >
          Start Your Application &rarr;
        </LinkButton>
      </section>

      {/* Footer stripe */}
      <div className="h-2 flex">
        {STRIPE_COLORS.map((c) => <div key={c} className={`flex-1 ${c}`} />)}
      </div>
    </>
  )
}
