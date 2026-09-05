import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Camera,
  Car,
  CheckCircle2,
  ChevronUp,
  ClipboardCheck,
  Clock,
  Copy,
  Download,
  Eye,
  FileText,
  Gauge,
  Mail,
  MapPin,
  Menu,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  Upload,
  UserRound,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import './styles.css';

const company = 'Scarsdale Auto Repair, Inc.';
const city = 'Mount Vernon, NY';
const streetAddress = '48 West Broad Street';
const phone = '9144828081';
const phoneHref = '+19144828081';
const email = 'scarsdaleautorepairinc@gmail.com';
const postingDate = 'June 14, 2026';
const basePath = import.meta.env.BASE_URL;
const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8001' : '');
const businessHours = [
  'Monday - Friday: 8:00 AM - 6:00 PM',
  'Saturday: By Appointment',
  'Sunday: Closed'
];

const summaryCards = [
  {
    title: 'Fleet Maintenance',
    text: 'Scheduled maintenance plans that help business vehicles stay ready for daily routes.',
    icon: ShieldCheck
  },
  {
    title: 'Commercial Vehicle Repair',
    text: 'Practical repairs for vans, light trucks, and company vehicles used in daily operations.',
    icon: Wrench
  },
  {
    title: 'Diagnostics',
    text: 'Clear troubleshooting for drivability, engine, electrical, and warning light concerns.',
    icon: Gauge
  },
  {
    title: 'Preventive Maintenance',
    text: 'Oil, fluid, brake, inspection, and safety checks focused on avoiding avoidable downtime.',
    icon: ClipboardCheck
  }
];

const services = [
  {
    title: 'Fleet maintenance',
    icon: ShieldCheck,
    text: 'Routine maintenance coordination for company vehicles, including mileage-based service planning.'
  },
  {
    title: 'Commercial vehicle repair',
    icon: Wrench,
    text: 'Repair support for work vans, trucks, and business vehicles used by local operators.'
  },
  {
    title: 'Preventive maintenance',
    icon: ClipboardCheck,
    text: 'Fluid checks, filters, inspections, tire checks, and scheduled service to reduce downtime.'
  },
  {
    title: 'Brake service',
    icon: CheckCircle2,
    text: 'Brake inspection, pad and rotor service, hydraulic checks, and safety-focused repair.'
  },
  {
    title: 'Suspension and steering repair',
    icon: Sparkles,
    text: 'Diagnosis and repair for handling, ride quality, steering, and suspension component concerns.'
  },
  {
    title: 'Engine diagnostics',
    icon: Stethoscope,
    text: 'Diagnostic support for check-engine lights, drivability issues, and performance problems.'
  },
  {
    title: 'Electrical diagnostics',
    icon: Zap,
    text: 'Testing for battery, charging, wiring, lighting, accessory, and electronic control issues.'
  },
  {
    title: 'DOT/inspection support',
    icon: ClipboardCheck,
    text: 'Inspection readiness support and documentation-minded service for commercial vehicle needs.'
  }
];

const faqs = [
  {
    question: 'Do I need an account or login to view job postings?',
    answer: 'No. The Careers page is public and available without a login.'
  },
  {
    question: 'Does this site connect to a fleet, inventory, or admin system?',
    answer: 'Only the Customer Service page connects to the internal repair workflow backend.'
  },
  {
    question: 'Can the job posting be printed for recruitment records?',
    answer: 'Yes. The Careers page includes a printable posting layout and a Print Posting button.'
  },
  {
    question: 'What area does the business serve?',
    answer: 'Scarsdale Auto Repair, Inc. is based in Mount Vernon, NY and supports commercial and fleet customers in the area.'
  }
];

const testimonials = [
  'Reliable communication and practical support for commercial vehicle maintenance.',
  'Professional service for vehicles that need to stay ready for daily business use.',
  'A straightforward repair partner for diagnostics, maintenance, and inspection readiness.'
];

const processSteps = [
  {
    title: 'Request',
    text: 'Share the vehicle concern, service need, or maintenance request.'
  },
  {
    title: 'Review',
    text: 'The issue is reviewed with practical diagnostics and clear service priorities.'
  },
  {
    title: 'Service',
    text: 'Repair or maintenance work is completed with attention to safety and reliability.'
  },
  {
    title: 'Return',
    text: 'Vehicles are prepared for return to daily commercial operation.'
  }
];

const serviceOptions = [
  'State inspection',
  'Tune up',
  'Brakes',
  'Suspension',
  'Engine',
  'Check engine light',
  'Oil change',
  'Tire service',
  'Electrical',
  'Diagnostic',
  'Other'
];

const statusLabels = {
  authorized: 'Authorized',
  inspection_complete: 'Tech concern uploaded',
  estimate_ready: 'Office reviewed',
  approved: 'Customer approved',
  in_progress: 'Work in progress',
  complete: 'Car ready',
  invoice_uploaded: 'Invoice ready',
  paid: 'Paid'
};

const shopStages = [
  ['authorized', 'Form signed'],
  ['inspection_complete', 'Tech notes'],
  ['estimate_ready', 'Office review'],
  ['approved', 'Approved'],
  ['in_progress', 'Working'],
  ['complete', 'Ready'],
  ['paid', 'Paid']
];

function routePath(path) {
  const normalizedBase = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${normalizedBase}${path.replace(/^\//, '')}`;
}

function currentRoute() {
  const baseUrl = basePath.replace(/\/$/, '');
  let path = window.location.pathname;
  if (baseUrl && baseUrl !== '/' && path.startsWith(baseUrl)) {
    path = path.slice(baseUrl.length) || '/';
  }
  return path.replace(/\/$/, '') || '/';
}

function fileUrl(storedPath) {
  if (!storedPath) return '';
  const name = storedPath.split('/').pop();
  return `${API_BASE}/api/files/${encodeURIComponent(name)}`;
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Shop-Request': '1', ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || 'Request failed');
  }
  return response.json();
}

function money(value) {
  return Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

const navItems = [
  { label: 'Home', href: routePath('/'), path: '/' },
  { label: 'About', href: routePath('/about'), path: '/about' },
  { label: 'Services', href: routePath('/services'), path: '/services' },
  { label: 'Careers', href: routePath('/careers'), path: '/careers' },
  { label: 'Customer Service', href: routePath('/customer-service'), path: '/customer-service' },
  { label: 'Contact', href: routePath('/contact'), path: '/contact' }
];

function Header({ activePath }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [activePath]);

  return (
    <header className="site-header">
      <a className="brand" href={routePath('/')}>
        <span className="brand-mark" aria-hidden="true"><Wrench size={20} /></span>
        <span>{company}</span>
      </a>
      <button className="nav-toggle-button" type="button" aria-label="Toggle navigation" onClick={() => setOpen((value) => !value)}>
        {open ? <X size={24} /> : <Menu size={24} />}
      </button>
      <nav className={`nav-links ${open ? 'is-open' : ''}`} aria-label="Primary navigation">
        {navItems.map((item) => (
          <a key={item.path} href={item.href} aria-current={activePath === item.path ? 'page' : undefined}>
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>{company}</strong>
        <span>{streetAddress}, {city} 10552</span>
      </div>
      <div className="footer-contact">
        <a href={`tel:${phoneHref}`}><Phone size={16} /> {phone}</a>
        <a href={`mailto:${email}`}><Mail size={16} /> {email}</a>
      </div>
      <p>&copy; {new Date().getFullYear()} {company}. All rights reserved.</p>
    </footer>
  );
}

function ButtonLink({ children, href, variant = 'primary' }) {
  return <a className={`button ${variant}`} href={href}>{children}</a>;
}

function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-content">
          <p className="eyebrow">Commercial Vehicle Repair and Fleet Maintenance</p>
          <h1>{company}</h1>
          <p>
            Professional auto repair, commercial diagnostics, fleet service, and preventive maintenance
            for businesses operating in New York and tristate areas.
          </p>
          <div className="hero-actions">
            <ButtonLink href={routePath('/contact')}>Request Service</ButtonLink>
            <ButtonLink href={routePath('/careers')} variant="secondary">View Careers</ButtonLink>
            <ButtonLink href={routePath('/customer-service')} variant="ghost">Customer Service</ButtonLink>
            <ButtonLink href={routePath('/contact')} variant="ghost">Contact Us</ButtonLink>
          </div>
        </div>
      </section>

      <SummaryCards />
      <AboutContent />
      <ServicesContent preview />
      <TestimonialsSection />
      <CareersPreview />
      <FaqSection />
      <ContactSection compact />
    </>
  );
}

function SummaryCards() {
  return (
    <section className="section summary-band" aria-label="Business summary">
      <div className="summary-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article className="summary-card" key={card.title}>
              <Icon size={24} aria-hidden="true" />
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AboutPage() {
  return (
    <>
      <PageTitle eyebrow="About Us" title={`About ${company}`}>
        Based in {city}, serving commercial and fleet customers with dependable repair and maintenance support.
      </PageTitle>
      <AboutContent />
      <TestimonialsSection />
      <ContactCta />
    </>
  );
}

function ServicesPage() {
  return (
    <>
      <PageTitle
        eyebrow="Services"
        title="Fleet and Commercial Vehicle Services"
        actions={<ButtonLink href={routePath('/contact')}>Request Service</ButtonLink>}
      >
        Repair, diagnostics, maintenance, and inspection support for business vehicles.
      </PageTitle>
      <ServicesContent />
      <ServiceProcess />
      <FaqSection />
      <ContactCta />
    </>
  );
}

function PageTitle({ eyebrow, title, children, actions }) {
  return (
    <section className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{children}</p>
      </div>
      {actions && <div className="page-title-actions">{actions}</div>}
    </section>
  );
}

function AboutContent() {
  return (
    <section className="section two-column">
      <div>
        <p className="eyebrow">About Us</p>
        <h2>Dependable service for commercial and fleet customers.</h2>
      </div>
      <div className="section-copy">
        <p>
          {company} is based in {city} and supports commercial vehicle operators, local businesses,
          and fleet customers with practical repair and maintenance services.
        </p>
        <p>
          The company focuses on clear diagnostics, preventive maintenance, and dependable repair work
          that helps vehicles stay safe, compliant, and ready for daily operation.
        </p>
      </div>
    </section>
  );
}

function ServicesContent({ preview = false }) {
  const visibleServices = preview ? services.slice(0, 4) : services;

  return (
    <section className="section services-band">
      <div className="section-heading">
        <p className="eyebrow">Services</p>
        <h2>Commercial repair and maintenance capabilities</h2>
        {!preview && (
          <p>
            Organized service support for commercial vehicles, fleet operators, and small businesses
            that need practical maintenance, diagnostics, and repair coordination.
          </p>
        )}
      </div>
      <div className="service-grid">
        {visibleServices.map((service) => {
          const Icon = service.icon;
          return (
            <article className="service-card" key={service.title}>
              <Icon size={24} aria-hidden="true" />
              <h3>{service.title}</h3>
              <p>{service.text}</p>
            </article>
          );
        })}
      </div>
      {preview && (
        <div className="section-action">
          <ButtonLink href={routePath('/services')} variant="outline">View All Services</ButtonLink>
        </div>
      )}
    </section>
  );
}

function ServiceProcess() {
  return (
    <section className="section process-band">
      <div className="section-heading">
        <p className="eyebrow">How Service Works</p>
        <h2>A simple process for business vehicle needs</h2>
      </div>
      <div className="process-grid">
        {processSteps.map((step, index) => (
          <article className="process-step" key={step.title}>
            <span>{index + 1}</span>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function CareersPreview() {
  return (
    <section className="section careers-preview">
      <div>
        <p className="eyebrow">Careers</p>
        <h2>Public career opportunities</h2>
        <p>
          Current job postings are available on the public Careers page. No login or account is required
          to view posted positions.
        </p>
      </div>
      <ButtonLink href={routePath('/careers')}>Open Careers Page</ButtonLink>
    </section>
  );
}

function CareersPage() {
  const [openSections, setOpenSections] = useState({
    overview: true,
    duties: true,
    requirements: false,
    salary: false,
    apply: true
  });
  const [copyStatus, setCopyStatus] = useState('');
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(Boolean(navigator.share));
  }, []);

  function toggleSection(section) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section]
    }));
  }

  async function copyJobLink() {
    const jobUrl = `${window.location.origin}${routePath('/careers')}`;
    await navigator.clipboard.writeText(jobUrl);
    setCopyStatus('Job posting link copied.');
    window.setTimeout(() => setCopyStatus(''), 2600);
  }

  async function sharePosting() {
    const jobUrl = `${window.location.origin}${routePath('/careers')}`;
    await navigator.share({
      title: 'Systems Administrator',
      text: `${company} is hiring a Systems Administrator in ${city}.`,
      url: jobUrl
    });
  }

  return (
    <>
      <PageTitle
        eyebrow="Careers"
        title="Careers"
        actions={<span className="position-badge">Open Position</span>}
      >
        Join Scarsdale Auto Repair, Inc. and support modern fleet maintenance, diagnostics, and automotive technology operations.
      </PageTitle>

      <main className="job-wrap">
        <article className="job-posting" aria-labelledby="systems-administrator-title">
          <div className="job-header">
            <div>
              <p className="eyebrow">Job Posting</p>
              <h2 id="systems-administrator-title">Systems Administrator</h2>
              <p className="job-location-line">{city}</p>
            </div>
            <div className="job-actions">
              <button className="print-button" type="button" onClick={() => window.print()}>
                <Printer size={18} aria-hidden="true" />
                Print Posting
              </button>
              <a className="button primary" href={`mailto:${email}?subject=Application%20for%20Systems%20Administrator%20Position`}>
                <Mail size={18} aria-hidden="true" />
                Email Resume
              </a>
              <a className="button outline" href={`tel:${phoneHref}`}>
                <Phone size={18} aria-hidden="true" />
                Call Us
              </a>
              <button className="print-button" type="button" onClick={copyJobLink}>
                <Copy size={18} aria-hidden="true" />
                Copy Job Link
              </button>
              {canShare && (
                <button className="print-button" type="button" onClick={sharePosting}>
                  <Share2 size={18} aria-hidden="true" />
                  Share Posting
                </button>
              )}
            </div>
          </div>

          {copyStatus && <p className="copy-status" role="status">{copyStatus}</p>}

          <dl className="job-details quick-summary" aria-label="Quick job summary">
            <div>
              <dt><BriefcaseBusiness size={17} aria-hidden="true" /> Position</dt>
              <dd>Systems Administrator</dd>
            </div>
            <div>
              <dt><MapPin size={17} aria-hidden="true" /> Location</dt>
              <dd>{city}</dd>
            </div>
            <div>
              <dt><Building2 size={17} aria-hidden="true" /> Employer</dt>
              <dd>{company}</dd>
            </div>
            <div>
              <dt><CalendarDays size={17} aria-hidden="true" /> Posting Date</dt>
              <dd>{postingDate}</dd>
            </div>
            <div>
              <dt><FileText size={17} aria-hidden="true" /> Salary</dt>
              <dd>$99,195/year</dd>
            </div>
            <div>
              <dt><Mail size={17} aria-hidden="true" /> Application Method</dt>
              <dd>Mail resume / email resume</dd>
            </div>
          </dl>

          <div className="job-accordion">
            <JobAccordionSection id="overview" title="Job Overview" open={openSections.overview} onToggle={() => toggleSection('overview')}>
              <dl className="overview-list">
                <div>
                  <dt>Job Title</dt>
                  <dd>Systems Administrator</dd>
                </div>
                <div>
                  <dt>Job Location</dt>
                  <dd>{city}</dd>
                </div>
                <div>
                  <dt>Employer</dt>
                  <dd>{company}</dd>
                </div>
                <div>
                  <dt>Posting Date</dt>
                  <dd>{postingDate}</dd>
                </div>
              </dl>
            </JobAccordionSection>

            <JobAccordionSection id="duties" title="Duties" open={openSections.duties} onToggle={() => toggleSection('duties')}>
              <p>
                Responsible for the Automotive IT Infrastructure including designing, configuring, and maintenance by supporting Amazon fleet vehicle diagnostics and maintenance operations. Integrate vehicle diagnostic systems (e.g., OBD-II readers, fault code scanners) with internal databases and service management software. Configure and optimize billing systems tied to repair logs, inspection records, and service schedules, ensuring accurate financial and operational reporting. Implement cybersecurity protocols, user access controls, and endpoint protection across networked systems. Coordinate system upgrades and automation tools to support preventive maintenance. Collaborate with mechanical and service teams to align IT systems with shop workflows and diagnostic procedures. Monitor system performance and automate alerts for IT or diagnostic failures. Train technicians and office staff on new IT tools, system dashboards, and software features that enhance diagnostic efficiency. Design and implement a public-facing company website to manage service appointments, vehicle diagnostics intake, and client communications.
              </p>
            </JobAccordionSection>

            <JobAccordionSection id="requirements" title="Requirements" open={openSections.requirements} onToggle={() => toggleSection('requirements')}>
              <p>
                Master's degree in Information Systems, Computer Science, or closely related field and 1 year of experience in the job offered or closely related position. Experience which may have been obtained concurrently must include 1 year of experience with: maintaining IT and network infrastructure to support fleet maintenance operations for Amazon; and configured and optimized billing systems tied to repair logs, inspection records, and service schedules, ensuring accurate financial and operational reporting.
              </p>
            </JobAccordionSection>

            <JobAccordionSection id="salary" title="Salary" open={openSections.salary} onToggle={() => toggleSection('salary')}>
              <p>$99,195/year</p>
            </JobAccordionSection>

            <JobAccordionSection id="apply" title="How to Apply" open={openSections.apply} onToggle={() => toggleSection('apply')}>
              <address>
                Fares Jamal<br />
                {company}<br />
                {streetAddress}<br />
                Mount Vernon, NY 10552<br />
                Email: <a href={`mailto:${email}`}>{email}</a><br />
                Phone: <a href={`tel:${phoneHref}`}>{phone}</a>
              </address>
            </JobAccordionSection>
          </div>
        </article>
      </main>
    </>
  );
}

function JobAccordionSection({ id, title, open, onToggle, children }) {
  return (
    <section className={`job-panel ${open ? 'is-open' : ''}`}>
      <button
        className="job-panel-trigger"
        type="button"
        aria-expanded={open}
        aria-controls={`job-panel-${id}`}
        onClick={onToggle}
      >
        <span>{title}</span>
        <ChevronUp size={18} aria-hidden="true" />
      </button>
      <div className="job-panel-body" id={`job-panel-${id}`} hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="section testimonials-band">
      <div className="section-heading">
        <p className="eyebrow">Reviews</p>
        <h2>Professional support for business vehicles</h2>
      </div>
      <div className="testimonial-grid">
        {testimonials.map((quote) => (
          <figure className="testimonial-card" key={quote}>
            <div aria-hidden="true">
              {[0, 1, 2, 3, 4].map((star) => <Star key={star} size={17} fill="currentColor" />)}
            </div>
            <blockquote>{quote}</blockquote>
            <figcaption>Commercial customer review</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function FaqSection() {
  return (
    <section className="section faq-band">
      <div className="section-heading">
        <p className="eyebrow">FAQ</p>
        <h2>Common questions</h2>
      </div>
      <div className="faq-list">
        {faqs.map((faq) => (
          <details key={faq.question}>
            <summary>{faq.question}</summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function ContactCta() {
  return (
    <section className="section careers-preview">
      <div>
        <p className="eyebrow">Contact</p>
        <h2>Need service information?</h2>
        <p>Use the Contact page for the company location, phone, email, business hours, and request form.</p>
      </div>
      <ButtonLink href={routePath('/contact')}>Contact Us</ButtonLink>
    </section>
  );
}

function CustomerServicePage() {
  if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE) {
    return <main className="section">
      <h1>Customer Service</h1>
      {import.meta.env.VITE_CUSTOMER_SERVICE_URL ? (
        <ButtonLink href={import.meta.env.VITE_CUSTOMER_SERVICE_URL}>Open Customer Service</ButtonLink>
      ) : <p>Customer Service is not available online yet. Please contact the shop.</p>}
    </main>;
  }
  return <CustomerServiceWorkspace />;
}

function CustomerServiceWorkspace() {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState('intake');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const tabs = [
    ['intake', '1. Customer Form'],
    ['tech', '2. Tech Findings'],
    ['office', '3. Office / Invoice'],
    ['history', '4. Vehicle History'],
    ['reports', '5. Reports']
  ];

  async function loadOrders() {
    setLoading(true);
    const data = await api('/api/orders');
    setOrders(data);
    if (!selectedId && data[0]) setSelectedId(data[0].id);
    setLoading(false);
  }

  async function loadSelected(id = selectedId) {
    if (!id) {
      setSelected(null);
      return;
    }
    setSelected(await api(`/api/orders/${id}`));
  }

  useEffect(() => {
    loadOrders().catch((err) => {
      setError(`Backend unavailable: ${err.message}`);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadSelected().catch((err) => setError(err.message));
  }, [selectedId, activeTab]);

  async function afterChange(text, orderId = selectedId) {
    setMessage(text);
    setError('');
    await loadOrders();
    await loadSelected(orderId);
  }

  return (
    <>
      <PageTitle eyebrow="Customer Service" title="Walk-In Complaint Workflow">
        Customer authorization, technician findings, office review, car-ready status, invoice preparation, and payment closeout.
      </PageTitle>
      <main className="shop-shell">
        <div className="service-tabs" role="tablist" aria-label="Customer service workflow">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? 'is-active' : ''}
              type="button"
              role="tab"
              aria-selected={activeTab === key}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="form-error">{error} {import.meta.env.PROD && <a href="/">Fleet Solutions Sign In</a>}</p>}
        {message && <p className="form-success">{message}</p>}

        {activeTab === 'intake' && (
          <section className="service-tab-panel">
            <div className="shop-panel full-panel">
              <IntakeForm onCreated={(result) => {
                setSelectedId(result.id);
                setActiveTab('tech');
                afterChange(`Customer service ticket created. Ticket code: ${result.access_code}`, result.id);
              }} onError={setError} />
            </div>
          </section>
        )}

        {activeTab === 'history' && (
          <section className="service-tab-panel">
            <HistoryTab />
          </section>
        )}

        {activeTab === 'reports' && <ReportsTab />}

        {activeTab !== 'intake' && activeTab !== 'history' && activeTab !== 'reports' && (
          <section className="service-tab-panel">
            <TicketSelector
              orders={orders}
              selectedId={selectedId}
              loading={loading}
              onSelect={setSelectedId}
            />
            <div className="shop-panel full-panel">
              {selected ? (
                <OrderDetail order={selected} view={activeTab} onChange={afterChange} onError={setError} />
              ) : (
                <div className="empty-state">
                  <ClipboardCheck size={42} />
                  <h2>No customer ticket selected</h2>
                  <p>Create a customer form first, then continue here.</p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function TicketSelector({ orders, selectedId, loading, onSelect }) {
  return (
    <section className="ticket-selector">
      <div className="panel-heading">
        <h2>Customer Tickets</h2>
        <span>{orders.length}</span>
      </div>
      {loading && <p className="muted">Loading orders...</p>}
      <div className="order-list">
        {orders.map((order) => (
          <button className={`order-row ${selectedId === order.id ? 'is-active' : ''}`} key={order.id} type="button" onClick={() => onSelect(order.id)}>
            <strong>{order.customer_name}</strong>
            <span>{[order.year, order.make, order.model].filter(Boolean).join(' ') || 'Vehicle'} | {order.plate || 'No plate'}</span>
            <small>{statusLabels[order.status] || order.status}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function IntakeForm({ onCreated, onError }) {
  const [selectedServices, setSelectedServices] = useState(['Diagnostic']);
  const [submitting, setSubmitting] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');

  function toggleService(service) {
    setSelectedServices((current) => (
      current.includes(service) ? current.filter((item) => item !== service) : [...current, service]
    ));
  }

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitting(true);
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.requested_services = selectedServices;
    payload.diagnostic_fee = Number(payload.diagnostic_fee || 0);
    try {
      const result = await api('/api/intake', { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      setSelectedServices(['Diagnostic']);
      setLookupMessage('');
      onCreated(result);
    } catch (err) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function decodeVin(event) {
    const form = event.currentTarget.form;
    const vin = form.elements.vin.value.trim();
    if (!vin) {
      setLookupMessage('Enter the VIN first, then decode vehicle info.');
      return;
    }
    try {
      setLookupMessage('Decoding VIN...');
      const vehicle = await api(`/api/vin/${encodeURIComponent(vin)}`);
      form.elements.year.value = vehicle.year || '';
      form.elements.make.value = vehicle.make || '';
      form.elements.model.value = vehicle.model || '';
      setLookupMessage(`${[vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(' ')} loaded from VIN.`);
    } catch (err) {
      setLookupMessage(err.message);
    }
  }

  async function lookupPlate(event) {
    const form = event.currentTarget.form;
    const plate = form.elements.plate.value.trim();
    const state = form.elements.plate_state.value.trim() || 'NY';
    if (!plate) {
      setLookupMessage('Enter the plate first.');
      return;
    }
    try {
      const vehicle = await api(`/api/plate/${encodeURIComponent(state)}/${encodeURIComponent(plate)}`);
      form.elements.vin.value = vehicle.vin || '';
      form.elements.year.value = vehicle.year || '';
      form.elements.make.value = vehicle.make || '';
      form.elements.model.value = vehicle.model || '';
      form.elements.mileage.value = vehicle.mileage || '';
      setLookupMessage(`${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ') || 'Vehicle'} loaded from saved plate history.`);
    } catch (err) {
      setLookupMessage(err.message);
    }
  }

  return (
    <form className="shop-form" onSubmit={submit}>
      <div className="panel-heading">
        <h2>Walk-In Form</h2>
        <UserRound size={22} />
      </div>
      <label>Customer name<input name="customer_name" required /></label>
      <label>Phone<input name="phone" required /></label>
      <label>Email<input name="email" type="email" /></label>
      <label>Address<input name="address" /></label>
      <label>Plate<input name="plate" /></label>
      <label>Plate state<input name="plate_state" defaultValue="NY" /></label>
      <label>VIN<input name="vin" /></label>
      <div className="lookup-actions">
        <button className="button outline" type="button" onClick={lookupPlate}>Lookup Plate</button>
        <button className="button outline" type="button" onClick={decodeVin}>Decode VIN</button>
      </div>
      {lookupMessage && <p className="lookup-message form-wide">{lookupMessage}</p>}
      <label>Year<input name="year" /></label>
      <label>Make<input name="make" /></label>
      <label>Model<input name="model" /></label>
      <label>Mileage<input name="mileage" /></label>
      <label className="form-wide">Customer complaint / concern<textarea name="concern" rows="4" required /></label>
      <fieldset className="form-wide checkbox-grid">
        <legend>Requested services</legend>
        {serviceOptions.map((service) => (
          <label key={service}>
            <input type="checkbox" checked={selectedServices.includes(service)} onChange={() => toggleService(service)} />
            {service}
          </label>
        ))}
      </fieldset>
      <label>Diagnostic fee<input name="diagnostic_fee" type="number" min="0" step="0.01" defaultValue="130" /></label>
      <label>Authorized by<input name="authorization_name" required /></label>
      <button className="button primary form-wide" type="submit" disabled={submitting}>
        <Plus size={18} /> Save Authorization
      </button>
    </form>
  );
}

function FindingHistory({ inspections, photos, onUpload }) {
  const unassigned = photos.filter((photo) => !photo.inspection_id);
  function attachments(items) {
    return <div className="photo-grid">{items.map((photo) => (
      <a key={photo.id} href={fileUrl(photo.stored_path)} target="_blank" rel="noreferrer">{photo.original_name}</a>
    ))}</div>;
  }
  return <div className="finding-history">
    {inspections.length === 0 && <p className="muted">Waiting for technician findings.</p>}
    {[...inspections].reverse().map((finding, index) => (
      <article className="finding-entry" key={finding.id}>
        <h4>Finding {index + 1} | {finding.technician || 'Technician'}</h4>
        <time dateTime={finding.created_at}>{new Date(finding.created_at).toLocaleString()}</time>
        <p><strong>Notes</strong><br />{finding.notes || 'No inspection notes.'}</p>
        <p><strong>Parts / area</strong><br />{finding.required_parts || 'No bad part listed.'}</p>
        <p><strong>Recommended work</strong><br />{finding.labor_notes || 'No recommendation listed.'}</p>
        {attachments(photos.filter((photo) => photo.inspection_id === finding.id))}
        {onUpload && <label className="file-button">
          <Camera size={18} /> Add Photo to Finding {index + 1}
          <input type="file" accept="image/*,video/*" onChange={(event) => onUpload(event, 'photo', finding.id)} />
        </label>}
      </article>
    ))}
    {unassigned.length > 0 && <section className="finding-entry"><h4>Other Ticket Photos</h4>{attachments(unassigned)}</section>}
  </div>;
}

function OrderDetail({ order, view, onChange, onError }) {
  const invoice = order.media.find((item) => item.kind === 'invoice');
  const photos = order.media.filter((item) => item.kind === 'photo');

  async function addInspection(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      await api(`/api/orders/${order.id}/inspection`, { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      onChange('Inspection saved.');
    } catch (err) {
      onError(err.message);
    }
  }

  async function addEstimateItem(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.qty = Number(payload.qty || 1);
    payload.unit_price = Number(payload.unit_price || 0);
    try {
      await api(`/api/orders/${order.id}/estimate-items`, { method: 'POST', body: JSON.stringify(payload) });
      form.reset();
      onChange('Estimate item added.');
    } catch (err) {
      onError(err.message);
    }
  }

  async function upload(event, kind, inspectionId) {
    const input = event.target;
    const chosen = input.files?.[0];
    if (!chosen) return;
    const body = new FormData();
    body.append('kind', kind);
    body.append('file', chosen);
    if (inspectionId) body.append('inspection_id', inspectionId);
    try {
      await api(`/api/orders/${order.id}/upload`, { method: 'POST', body });
      input.value = '';
      onChange(kind === 'invoice' ? 'Invoice uploaded for customer.' : 'Photo uploaded.');
    } catch (err) {
      onError(err.message);
    }
  }

  async function setStatus(status) {
    try {
      await api(`/api/orders/${order.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      onChange(`Status changed to ${statusLabels[status] || status}.`);
    } catch (err) {
      onError(err.message);
    }
  }

  async function approve() {
    try {
      await api(`/api/orders/${order.id}/approve`, { method: 'POST' });
      onChange('Estimate approved.');
    } catch (err) {
      onError(err.message);
    }
  }

  async function paid(event) {
    event.preventDefault();
    const amount = new FormData(event.currentTarget).get('amount');
    try {
      await api(`/api/orders/${order.id}/paid`, { method: 'POST', body: JSON.stringify({ amount }) });
      onChange('Order marked paid.');
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <div className="order-detail">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Ticket #{order.id}</p>
          <h2>{order.customer_name}</h2>
          <p>{[order.year, order.make, order.model].filter(Boolean).join(' ') || 'Vehicle'} | Plate {order.plate || 'N/A'}</p>
        </div>
        <div className="access-code">
          <span>Ticket code</span>
          <strong>{order.access_code}</strong>
        </div>
      </div>

      <StageTracker status={order.status} />

      <div className="detail-grid">
        <InfoBlock icon={Phone} title="Customer" lines={[order.phone, order.email, order.address]} />
        <InfoBlock icon={Car} title="Vehicle" lines={[order.vin && `VIN ${order.vin}`, order.mileage && `${order.mileage} miles`]} />
        <InfoBlock icon={ShieldCheck} title="Authorization" lines={[`Authorized by ${order.authorization_name}`, order.authorized_at, `Diagnostic fee ${money(order.diagnostic_fee)}`]} />
      </div>

      <section className="detail-section">
        <h3>Customer Complaint and Requested Area</h3>
        <p>{order.concern}</p>
        <div className="tag-row">{order.requested_services.map((service) => <span key={service}>{service}</span>)}</div>
      </section>

      {view === 'tech' && <section className="split-section">
        <form className="mini-form" onSubmit={addInspection}>
          <h3>Technician Findings</h3>
          <label>Technician<input name="technician" /></label>
          <label>What the tech found<textarea name="notes" rows="4" /></label>
          <label>Bad part / area of concern<textarea name="required_parts" rows="3" /></label>
          <label>Recommended work<textarea name="labor_notes" rows="3" /></label>
          <button className="button primary" type="submit"><ClipboardCheck size={18} /> Save Tech Concern</button>
        </form>
        <div className="mini-card">
          <h3>Office View</h3>
          <FindingHistory inspections={order.inspections} photos={photos} onUpload={upload} />
        </div>
      </section>}

      {view === 'tech' && <div className="upload-actions">
        <button className="button outline" type="button" onClick={() => setStatus('in_progress')}>In Progress</button>
        <button className="button primary" type="button" onClick={() => setStatus('complete')}><CheckCircle2 size={18} /> Car Ready</button>
      </div>}

      {view === 'office' && (
        <section className="split-section">
          <div className="mini-card">
            <h3>Tech Findings to Show Customer</h3>
            <FindingHistory inspections={order.inspections} photos={photos} />
          </div>
          <form className="mini-form" onSubmit={addEstimateItem}>
            <h3>Office Work Approval</h3>
            <label>Work customer approved<input name="description" required placeholder="Front brake pads and rotors" /></label>
            <label>Qty<input name="qty" type="number" min="0" step="0.01" defaultValue="1" /></label>
            <label>Amount<input name="unit_price" type="number" min="0" step="0.01" defaultValue="0" /></label>
            <button className="button primary" type="submit"><Plus size={18} /> Add Approved Work</button>
          </form>
        </section>
      )}

      {view === 'office' && <section className="mini-card">
          <h3>Approved Work / Invoice Prep</h3>
          <div className="line-items">
            {order.estimate_items.map((item) => (
              <div key={item.id}>
                <span>{item.description}</span>
                <strong>{money(item.qty * item.unit_price)}</strong>
              </div>
            ))}
          </div>
          <div className="total-line"><span>Invoice total</span><strong>{money(order.estimate_total)}</strong></div>
          <button className="button outline" type="button" onClick={approve}><CheckCircle2 size={18} /> Customer Approved</button>
      </section>}

      {view === 'office' && <section className="detail-section">
        <h3>Ready, Invoice, and Payment</h3>
        <div className="upload-actions">
          <label className="file-button">
            <Upload size={18} /> Upload Invoice
            <input type="file" accept=".pdf,image/*" onChange={(event) => upload(event, 'invoice')} />
          </label>
          <button className="button outline" type="button" onClick={() => setStatus('in_progress')}>In Progress</button>
          <button className="button outline" type="button" onClick={() => setStatus('complete')}>Car Ready</button>
        </div>
        {order.paid_amount_cents != null && order.paid_at ? (
          <p className="form-success">Payment recorded: {money(order.paid_amount_cents / 100)} on {formatDate(order.paid_at)}</p>
        ) : <form className="payment-form" onSubmit={paid} key={`${order.id}-${order.estimate_total}`}>
          <label>Amount received ($)<input name="amount" type="number" min="0" max="99999999" step="0.01" defaultValue={Number(order.estimate_total || 0).toFixed(2)} required /></label>
          <button className="button primary" type="submit"><CheckCircle2 size={18} /> Mark Paid</button>
        </form>}
        {invoice && <a className="invoice-link" href={fileUrl(invoice.stored_path)} target="_blank" rel="noreferrer"><Download size={18} /> Download invoice: {invoice.original_name}</a>}
        <div className="photo-grid">
          {photos.map((photo) => (
            <a key={photo.id} href={fileUrl(photo.stored_path)} target="_blank" rel="noreferrer">{photo.original_name}</a>
          ))}
        </div>
      </section>}
    </div>
  );
}

function ReportsTab() {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [period, setPeriod] = useState('day');
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(today.slice(0, 7));
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const on = period === 'day' ? selectedDate : `${selectedMonth}-01`;
    setReport(null);
    setError('');
    if (!(period === 'day' ? selectedDate : selectedMonth)) return;
    setLoading(true);
    api(`/api/reports/income?period=${period}&on=${encodeURIComponent(on)}`)
      .then((data) => { if (!cancelled) setReport(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, selectedDate, selectedMonth, refresh]);

  function exportCsv() {
    const rows = [['Date (New York)', 'Customer visits', 'Paid tickets', 'Income received (USD)', 'Missing payment amounts'],
      ...report.days.map((day) => [day.date, day.visits, day.paid_tickets, (day.income_cents / 100).toFixed(2), day.missing_amounts]),
      ['Total', report.totals.visits, report.totals.paid_tickets, (report.totals.income_cents / 100).toFixed(2), report.totals.missing_amounts]];
    const url = URL.createObjectURL(new Blob([rows.map((row) => row.join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `income-${report.start}-${report.end}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="service-tab-panel reports-panel">
    <div className="panel-heading"><h2>Income Reports</h2><span>New York time</span></div>
    <div className="report-controls">
      <div className="service-tabs report-period" role="group" aria-label="Report period">
        <button type="button" className={period === 'day' ? 'is-active' : ''} aria-pressed={period === 'day'} onClick={() => setPeriod('day')}>Daily</button>
        <button type="button" className={period === 'month' ? 'is-active' : ''} aria-pressed={period === 'month'} onClick={() => setPeriod('month')}>Monthly</button>
      </div>
      {period === 'day' ? <label>Report date<input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
        : <label>Report month<input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>}
      <button className="button outline" type="button" disabled={loading} onClick={() => setRefresh((value) => value + 1)} aria-label="Refresh report" title="Refresh report"><RefreshCw size={18} /></button>
      <button className="button outline" type="button" disabled={!report || loading} onClick={exportCsv}><Download size={18} /> Export CSV</button>
    </div>
    {loading && <p role="status">Loading report...</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {report && <>
      <dl className="report-totals">
        <div><dt>Customer visits</dt><dd>{report.totals.visits}</dd></div>
        <div><dt>Paid tickets</dt><dd>{report.totals.paid_tickets}</dd></div>
        <div><dt>Income received</dt><dd>{money(report.totals.income_cents / 100)}</dd></div>
      </dl>
      {report.totals.missing_amounts > 0 && <p className="form-error">{report.totals.missing_amounts} paid ticket(s) have no recorded payment amount and are excluded from income.</p>}
      {period === 'month' && <div className="report-table-wrap"><table className="report-table">
        <caption>Daily Breakdown</caption><thead><tr><th>Date</th><th>Customer visits</th><th>Paid tickets</th><th>Income received</th></tr></thead>
        <tbody>{report.days.map((day) => <tr key={day.date}><td>{day.date}</td><td>{day.visits}</td><td>{day.paid_tickets}</td><td>{money(day.income_cents / 100)}{day.missing_amounts > 0 && ' *'}</td></tr>)}</tbody>
        <tfoot><tr><th>Total</th><td>{report.totals.visits}</td><td>{report.totals.paid_tickets}</td><td>{money(report.totals.income_cents / 100)}</td></tr></tfoot>
      </table></div>}
      <div className="report-table-wrap"><table className="report-table">
        <caption>Payments Received</caption><thead><tr><th>Date</th><th>Ticket</th><th>Customer</th><th>Plate</th><th>Amount received</th></tr></thead>
        <tbody>{report.payments.length ? report.payments.map((payment) => <tr key={payment.id}><td>{payment.date}</td><td>#{payment.id}</td><td>{payment.customer_name}</td><td>{payment.plate || '-'}</td><td>{payment.paid_amount_cents == null ? 'Not recorded' : money(payment.paid_amount_cents / 100)}</td></tr>) : <tr><td colSpan="5">No payments recorded for this period.</td></tr>}</tbody>
      </table></div>
      <div className="report-table-wrap"><table className="report-table">
        <caption>Customer Visits</caption><thead><tr><th>Date</th><th>Ticket</th><th>Customer</th><th>Plate</th></tr></thead>
        <tbody>{report.visits.length ? report.visits.map((visit) => <tr key={visit.id}><td>{visit.date}</td><td>#{visit.id}</td><td>{visit.customer_name}</td><td>{visit.plate || '-'}</td></tr>) : <tr><td colSpan="4">No customer visits for this period.</td></tr>}</tbody>
      </table></div>
    </>}
  </section>;
}

function HistoryTab() {
  const [history, setHistory] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function searchHistory(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const params = new URLSearchParams();
    const plate = formData.get('plate')?.toString().trim();
    const vin = formData.get('vin')?.toString().trim();
    if (plate) params.set('plate', plate);
    if (vin) params.set('vin', vin);
    setLoading(true);
    setError('');
    setHistory(null);
    try {
      setHistory(await api(`/api/history?${params.toString()}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const vehicleTitle = history
    ? [history.vehicle.year, history.vehicle.make, history.vehicle.model].filter(Boolean).join(' ') || 'Vehicle'
    : '';

  return (
    <div className="shop-panel history-panel">
      <div className="panel-heading">
        <h2>Vehicle History</h2>
        <FileText size={22} aria-hidden="true" />
      </div>
      <form className="history-search" onSubmit={searchHistory}>
        <label>Plate<input name="plate" placeholder="Example: ABC123" /></label>
        <label>VIN<input name="vin" placeholder="Enter VIN if available" /></label>
        <button className="button primary" type="submit"><Search size={18} /> Search History</button>
      </form>
      {loading && <p className="muted">Searching history...</p>}
      {error && <p className="form-error">{error}</p>}
      {history && (
        <div className="history-results">
          <section className="history-vehicle">
            <div>
              <p className="eyebrow">Saved Vehicle</p>
              <h3>{vehicleTitle}</h3>
              <p>Plate: {history.vehicle.plate || 'Not recorded'}</p>
              <p>VIN: {history.vehicle.vin || 'Not recorded'}</p>
              <p>Last mileage: {history.vehicle.mileage || 'Not recorded'}</p>
            </div>
            <strong>{history.visits.length} visit{history.visits.length === 1 ? '' : 's'}</strong>
          </section>
          <div className="history-list">
            {history.visits.map((visit) => (
              <article className="history-visit" key={visit.id}>
                <div className="history-visit-head">
                  <div>
                    <p className="eyebrow">Visit #{visit.id}</p>
                    <h3>{formatDate(visit.date)}</h3>
                  </div>
                  <span>{statusLabels[visit.status] || visit.status}</span>
                </div>
                <div className="history-meta">
                  <p><strong>Mileage</strong>{visit.mileage || 'Not recorded'}</p>
                  <p><strong>Ready</strong>{formatDate(visit.ready_at)}</p>
                  <p><strong>Paid</strong>{formatDate(visit.paid_at)}</p>
                  <p><strong>Total</strong>{money(visit.invoice_total)}</p>
                </div>
                <section>
                  <h4>Customer Concern</h4>
                  <p>{visit.concern}</p>
                  <div className="tag-row">{visit.requested_services.map((service) => <span key={service}>{service}</span>)}</div>
                </section>
                {visit.inspections?.length > 0 && (
                  <section>
                    <h4>Tech Findings</h4>
                    <FindingHistory inspections={visit.inspections} photos={(visit.media || []).filter((item) => item.kind === 'photo')} />
                  </section>
                )}
                <section>
                  <h4>Work Done</h4>
                  {visit.work_done.length > 0 ? (
                    <div className="line-items">
                      {visit.work_done.map((item) => (
                        <div key={`${visit.id}-${item.description}`}>
                          <span>{item.description}</span>
                          <strong>{money(item.line_total)}</strong>
                        </div>
                      ))}
                    </div>
                  ) : <p className="muted">No approved work recorded.</p>}
                </section>
                <section className="history-invoices">
                  <h4>Uploaded Invoices</h4>
                  {(visit.media || []).some((item) => item.kind === 'invoice') ? (
                    (visit.media || []).filter((item) => item.kind === 'invoice').map((invoice) => (
                      <div className="history-invoice-row" key={invoice.id}>
                        <div className="history-invoice-name">
                          <strong>{invoice.original_name}</strong>
                          <span>Uploaded {formatDate(invoice.uploaded_at)}</span>
                        </div>
                        <div className="history-invoice-actions">
                          <a className="button outline" href={fileUrl(invoice.stored_path)} target="_blank" rel="noreferrer" aria-label={`View invoice ${invoice.original_name}`}><Eye size={18} /> View</a>
                          <a className="button outline" href={`${fileUrl(invoice.stored_path)}?download=true`} aria-label={`Download invoice ${invoice.original_name}`}><Download size={18} /> Download</a>
                        </div>
                      </div>
                    ))
                  ) : <p className="muted">No invoice uploaded for this visit.</p>}
                </section>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StageTracker({ status }) {
  const trackedStatus = status === 'invoice_uploaded' ? 'complete' : status;
  const activeIndex = Math.max(0, shopStages.findIndex(([key]) => key === trackedStatus));
  return (
    <ol className="stage-tracker">
      {shopStages.map(([key, label], index) => (
        <li key={key} className={index <= activeIndex ? 'is-done' : ''}>
          <span>{index + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function InfoBlock({ icon: Icon, title, lines }) {
  return (
    <article className="info-block">
      <Icon size={20} />
      <h3>{title}</h3>
      {lines.filter(Boolean).map((line) => <p key={line}>{line}</p>)}
    </article>
  );
}

function ContactSection({ compact = false }) {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();
    setSubmitted(true);
    const form = event.currentTarget;
    form.reset();
  }

  return (
    <section className={`section contact-band ${compact ? 'is-compact' : ''}`} id="contact">
      <div className="contact-layout">
        <div>
          <p className="eyebrow">Contact</p>
          <h2>{compact ? company : 'Request Service Information'}</h2>
          <div className="contact-list">
            <p><MapPin size={19} aria-hidden="true" /> {streetAddress}, Mount Vernon, NY 10552</p>
            <a href={`tel:${phoneHref}`}><Phone size={19} aria-hidden="true" /> {phone}</a>
            <a href={`mailto:${email}`}><Mail size={19} aria-hidden="true" /> {email}</a>
            {!compact && (
              <p className="hours-card">
                <Clock size={19} aria-hidden="true" />
                <span>
                  <strong>Business Hours</strong>
                  {businessHours.map((line) => <span key={line}>{line}</span>)}
                </span>
              </p>
            )}
          </div>
        </div>

        {!compact && (
          <form className="contact-form" onSubmit={handleSubmit}>
            <label>
              Name
              <input name="name" type="text" autoComplete="name" required />
            </label>
            <label>
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              Phone
              <input name="phone" type="tel" autoComplete="tel" />
            </label>
            <label>
              Service Needed
              <select name="service" defaultValue="">
                <option value="" disabled>Select a service</option>
                {services.map((service) => (
                  <option key={service.title} value={service.title}>{service.title}</option>
                ))}
              </select>
            </label>
            <label className="form-wide">
              Message
              <textarea name="message" rows="5" required />
            </label>
            <button className="button primary form-wide" type="submit">Submit Request</button>
            {submitted && (
              <p className="form-success" role="status">Thank you. Your request has been received.</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}

function ContactPage() {
  return (
    <>
      <PageTitle
        eyebrow="Contact"
        title={company}
        actions={<ButtonLink href={`mailto:${email}`} variant="outline">Email Us</ButtonLink>}
      >
        Request service information or contact the Mount Vernon, NY office.
      </PageTitle>
      <ContactSection />
      <FaqSection />
    </>
  );
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 520);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button className={`back-to-top ${visible ? 'is-visible' : ''}`} type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
      <ChevronUp size={22} />
    </button>
  );
}

function App() {
  const [activePath, setActivePath] = useState(currentRoute);
  const pages = useMemo(() => ({
    '/': <HomePage />,
    '/about': <AboutPage />,
    '/services': <ServicesPage />,
    '/careers': <CareersPage />,
    '/customer-service': <CustomerServicePage />,
    '/shop': <CustomerServicePage />,
    '/contact': <ContactPage />
  }), []);

  useEffect(() => {
    function syncRoute() {
      setActivePath(currentRoute());
    }
    function handleInternalLink(event) {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('a');
      if (!link || link.target || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const isSiteRoute = navItems.some((item) => url.pathname === new URL(item.href, window.location.href).pathname);
      if (!isSiteRoute || url.pathname === window.location.pathname) return;
      event.preventDefault();
      window.history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActivePath(currentRoute());
    }
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('click', handleInternalLink);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('click', handleInternalLink);
    };
  }, []);

  return (
    <div>
      <Header activePath={activePath} />
      {pages[activePath] || <HomePage />}
      <Footer />
      <BackToTop />
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
