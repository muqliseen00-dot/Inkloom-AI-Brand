import { useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  useGetInkloomDashboard, getGetInkloomDashboardQueryKey,
  useListInkloomReviews, getListInkloomReviewsQueryKey,
  useCreateInkloomReview, useGetInkloomReview, getGetInkloomReviewQueryKey,
  useDecideInkloomReview, useListInkloomRules, getListInkloomRulesQueryKey,
  useCreateInkloomRule, useUpdateInkloomRule, useDeleteInkloomRule,
} from '@workspace/api-client-react';
import type { BrandRule, BrandRuleInput, BrandRuleUpdate, Review } from '@workspace/api-client-react';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen,
  Check, CheckCheck, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, Clock3,
  FileClock, FileSearch, FileText, Filter, History, Home, Inbox, Info, LayoutDashboard,
  ListChecks, Menu, Plus, Search, Shield, ShieldAlert, Sparkles, Type, X, Eye, Trash2,
  Pencil, ExternalLink, FilePlus2, ScanText, WandSparkles, CheckCircle2,
} from 'lucide-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 20_000 } } });

type ReviewStatus = 'Pending' | 'Approved' | 'Needs Changes' | 'Dismissed';
const navItems = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/review', label: 'New review', icon: FilePlus2 },
  { href: '/approvals', label: 'Approvals', icon: ClipboardCheck },
  { href: '/findings', label: 'Findings', icon: ScanText },
  { href: '/guidelines', label: 'Guidelines', icon: BookOpen },
  { href: '/history', label: 'Review history', icon: History },
];
const categories = ['tone', 'terminology', 'prohibited_claim', 'approved_messaging', 'disclaimer', 'accessibility', 'visual'] as const;
const categoryName: Record<string, string> = {
  tone: 'Tone', terminology: 'Terminology', prohibited_claim: 'Prohibited claims',
  approved_messaging: 'Approved messaging', disclaimer: 'Disclaimers',
  accessibility: 'Accessibility', visual: 'Visual',
};
const severityClass = (severity?: string) => `pill pill-${severity || 'low'}`;
const statusClass = (status?: string) => status === 'Approved' ? 'pill pill-approved' : status === 'Needs Changes' ? 'pill pill-changes' : status === 'Dismissed' ? 'pill pill-dismissed' : 'pill pill-pending';
const fmtDate = (date?: string) => date ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date)) : '—';
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.';

function Brand() {
  return <div className="brand-mark" data-testid="brand-inkloom">
    <div className="brand-symbol"><Type size={20} strokeWidth={2.4}/></div>
    <span className="brand-name">inkloom</span>
    <span style={{ marginLeft: 'auto', fontSize: 9, color: '#a69bc9', letterSpacing: 1.1, fontFamily: 'var(--app-font-mono)' }}>AI</span>
  </div>;
}

function NavLinks({ pathname, mobile = false }: { pathname: string; mobile?: boolean }) {
  return <>{navItems.map(({ href, label, icon: Icon }) => {
    const active = href === '/' ? pathname === '/' : href === '/review' ? pathname === '/review' : pathname.startsWith(href);
    return <Link href={href} key={href} className={`nav-link ${active ? 'active' : ''}`} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
      <Icon size={17} strokeWidth={1.8}/><span>{label}</span>
    </Link>;
  })}</>;
}

function Shell({ children }: { children: React.ReactNode }) {
  const [path] = useLocation();
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand/>
      <div className="nav-label">Workspace</div>
      <NavLinks pathname={path}/>
      <div className="sidebar-foot">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="team-avatar">MK</div>
          <div><div style={{ color: '#f3f1fb', fontSize: 12, fontWeight: 600 }}>MUQLISEEN00</div><div style={{ color: '#929bb2', fontSize: 10, marginTop: 2 }}>Muqliseen · Team lead</div></div>
          <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#8790a8' }}/>
        </div>
        <div style={{ color: '#808ba4', fontSize: 10, lineHeight: 1.55, padding: '16px 0 0' }}>Gagagana B J · Meghana K<br/>Human review stays in control. Your team decides what ships.</div>
      </div>
    </aside>
    <div className="main-area">
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="mobile-hide" style={{ color: '#9096a8', fontSize: 12 }}>Brand governance</span>
          <ChevronRight size={14} className="mobile-hide" color="#aeb2bf"/>
          <span style={{ color: '#464e68', fontSize: 12, fontWeight: 600 }} data-testid="text-workspace-label">Inkloom workspace</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="pill" style={{ color: '#5e4a9f', background: '#f0ecfa' }}><Shield size={12}/> Rules active</span>
          <div className="team-avatar" style={{ width: 29, height: 29 }}>MK</div>
        </div>
      </header>
      <nav className="mobile-nav"><NavLinks pathname={path} mobile/></nav>
      {children}
    </div>
  </div>;
}

function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18, marginBottom: 27, flexWrap: 'wrap' }}>
    <div><div className="eyebrow">{eyebrow}</div><h1 className="page-title" data-testid={`heading-${title.toLowerCase().replaceAll(' ', '-')}`}>{title}</h1>{subtitle && <div className="page-subtitle">{subtitle}</div>}</div>
    {action}
  </div>;
}

function LoadingCards() {
  return <div style={{ display: 'grid', gap: 16 }}>{[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 94 }}/>)}</div>;
}
function QueryError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="empty-state" data-testid="state-query-error"><AlertCircle size={26} color="#bd5b57" style={{ margin: '0 auto 12px' }}/><div style={{ color: '#303a58', fontWeight: 700, marginBottom: 6 }}>Couldn’t load this view</div><div style={{ fontSize: 12, marginBottom: 17 }}>{message}</div><button className="btn" onClick={retry} data-testid="button-retry">Try again</button></div>;
}
function StatCard({ label, value, note, icon: Icon, accent }: { label: string; value: number; note: string; icon: typeof Activity; accent: string }) {
  return <div className="card" style={{ padding: '19px 20px', position: 'relative', overflow: 'hidden' }} data-testid={`stat-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><div style={{ color: '#727b92', fontSize: 11, fontWeight: 600 }}>{label}</div><div style={{ font: '700 29px var(--app-font-display)', color: '#1c2948', letterSpacing: -1, marginTop: 7 }}>{value}</div></div><div style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', color: accent, background: `${accent}14` }}><Icon size={17}/></div></div>
    <div style={{ color: '#8c93a5', fontSize: 10, marginTop: 10 }}>{note}</div>
  </div>;
}

function ReviewRow({ review, index }: { review: Review; index: number }) {
  const openFindings = review.findings?.filter(f => f.status === 'open').length || 0;
  return <tr className="table-row" data-testid={`row-review-${review.id}`}>
    <td style={{ padding: '14px 12px 14px 19px' }}><Link href={`/review/${review.id}`} style={{ color: '#283454', fontWeight: 600, textDecoration: 'none', fontSize: 12 }} data-testid={`link-review-${review.id}`}>{review.title}</Link><div style={{ color: '#8b92a4', fontSize: 10, marginTop: 4 }}>{review.channel}</div></td>
    <td style={{ padding: 12 }}><span className={statusClass(review.status)} data-testid={`status-review-${review.id}`}>{review.status}</span></td>
    <td style={{ padding: 12, color: '#626c83', fontSize: 11 }}>{openFindings} open</td>
    <td style={{ padding: 12, color: '#778096', fontSize: 11 }}>{fmtDate(review.updatedAt || review.createdAt)}</td>
    <td style={{ padding: '12px 18px 12px 12px', textAlign: 'right' }}><Link href={`/review/${review.id}`} className="btn btn-quiet" data-testid={`button-open-review-${review.id}`} aria-label={`Open ${review.title}`}><ArrowRight size={15}/></Link></td>
  </tr>;
}

function Dashboard() {
  const q = useGetInkloomDashboard();
  const dashboard = q.data;
  if (q.isLoading) return <main className="page-wrap"><LoadingCards/></main>;
  if (q.isError || !dashboard) return <main className="page-wrap"><QueryError message={errorText(q.error)} retry={() => q.refetch()}/></main>;
  return <main className="page-wrap">
    <PageHeader eyebrow="Workspace overview" title="Good work starts with a second look." subtitle="A clear view of the copy your team is reviewing—and what needs a human decision." action={<Link href="/review" className="btn btn-primary" data-testid="button-start-review"><Plus size={15}/> Start a review</Link>}/>
    <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 13, marginBottom: 21 }}>
      <StatCard label="Reviews received" value={dashboard.totalReviews} note="All submitted content" icon={FileText} accent="#7658c9"/>
      <StatCard label="Awaiting review" value={dashboard.pendingReviews} note="Human decision required" icon={Clock3} accent="#b77d25"/>
      <StatCard label="Open findings" value={dashboard.openFindings} note={`${dashboard.highRiskFindings} high-risk signals`} icon={ShieldAlert} accent="#b9564d"/>
      <StatCard label="Approved" value={dashboard.approvedReviews} note={`${dashboard.needsChanges} need changes`} icon={BadgeCheck} accent="#388364"/>
    </div>
     <div className="dashboard-panels" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.65fr) minmax(260px,.85fr)', gap: 17 }}>
      <section className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '19px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div><h2 style={{ font: '700 15px var(--app-font-display)', margin: 0, color: '#263250' }}>Recent reviews</h2><p style={{ margin: '5px 0 0', fontSize: 11, color: '#8a91a4' }}>Latest content checked against your brand rules</p></div><Link className="btn" href="/history" data-testid="link-all-reviews">View history <ArrowRight size={13}/></Link></div>
        {dashboard.recentReviews?.length ? <div className="table-scroll"><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr style={{ color: '#9198a9', fontSize: 9, textTransform: 'uppercase', letterSpacing: .8 }}><th style={{ padding: '10px 12px 10px 19px', fontWeight: 600 }}>Content</th><th style={{ padding: 10, fontWeight: 600 }}>Status</th><th style={{ padding: 10, fontWeight: 600 }}>Signals</th><th style={{ padding: 10, fontWeight: 600 }}>Updated</th><th/></tr></thead><tbody>{dashboard.recentReviews.map((r, i) => <ReviewRow key={r.id} review={r} index={i}/>)}</tbody></table></div> : <Empty label="No reviews yet" body="Submit a piece of copy to see the first review here." action={<Link href="/review" className="btn btn-primary" data-testid="button-empty-review">Create a review</Link>}/>}
      </section>
      <section className="card" style={{ padding: 19 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}><div><h2 style={{ font: '700 15px var(--app-font-display)', margin: 0, color: '#263250' }}>Activity</h2><p style={{ margin: '5px 0 0', fontSize: 11, color: '#8a91a4' }}>A human-led audit trail</p></div><Activity size={17} color="#7865b2"/></div>
        {dashboard.recentActivity?.length ? <div style={{ display: 'grid', gap: 17 }}>{dashboard.recentActivity.slice(0, 7).map((event, i) => <div key={event.id} style={{ display: 'grid', gridTemplateColumns: '22px 1fr', gap: 10 }} data-testid={`activity-${event.id}`}><div style={{ width: 22, height: 22, borderRadius: '50%', background: i === 0 ? '#eee9fc' : '#f2f3f7', display: 'grid', placeItems: 'center', color: '#7258b8' }}><Check size={12}/></div><div><div style={{ fontSize: 11, lineHeight: 1.45, color: '#535d76' }}><b style={{ color: '#283451' }}>{event.actor}</b> {event.action.toLowerCase()} <b style={{ color: '#283451' }}>{event.reviewTitle}</b></div><div style={{ fontSize: 9, color: '#989fb0', marginTop: 4 }}>{fmtDate(event.at)}</div></div></div>)}</div> : <div style={{ fontSize: 12, color: '#8b92a4', padding: '24px 0' }}>New decisions and submissions will appear here.</div>}
      </section>
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f1effa', border: '1px solid #e4def5', borderRadius: 11, padding: '12px 14px', color: '#635787', fontSize: 11, lineHeight: 1.55 }} data-testid="notice-rule-based"><Info size={15} style={{ flex: '0 0 auto', marginTop: 1 }}/> Inkloom checks deterministic, configurable text rules. A flag is a review signal—not proof that a factual claim is true or false. A person makes every final decision.</div>
    <div style={{ marginTop: 9, color: '#7e6d4e', background: '#fffbf2', border: '1px solid #eee3cc', borderRadius: 9, padding: '10px 13px', fontSize: 10 }} data-testid="notice-demo-access">Hackathon demo: sign-in and role controls are not implemented. Do not submit confidential content.</div>
  </main>;
}

function Empty({ label, body, action }: { label: string; body: string; action?: React.ReactNode }) {
  return <div className="empty-state" data-testid="state-empty"><div style={{ width: 42, height: 42, margin: '0 auto 13px', borderRadius: 13, background: '#f0edfa', color: '#7158ba', display: 'grid', placeItems: 'center' }}><FileSearch size={19}/></div><div style={{ color: '#333d59', fontWeight: 700, fontSize: 14 }}>{label}</div><p style={{ fontSize: 11, maxWidth: 330, margin: '7px auto 17px', lineHeight: 1.55 }}>{body}</p>{action}</div>;
}

function Editor() {
  const [title, setTitle] = useState('');
  const [channel, setChannel] = useState('Website');
  const [content, setContent] = useState('');
  const [location, setLocation] = useLocation();
  const client = useQueryClient();
  const create = useCreateInkloomReview();
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    create.mutate({ data: { title: title.trim(), channel, content: content.trim() } }, {
      onSuccess: review => {
        client.invalidateQueries({ queryKey: getListInkloomReviewsQueryKey() });
        client.invalidateQueries({ queryKey: getGetInkloomDashboardQueryKey() });
        setLocation(`/review/${review.id}`);
      },
    });
  };
  return <main className="page-wrap">
    <PageHeader eyebrow="Content review" title="Put the copy through its paces." subtitle="Submit content to check it against the rules your team has configured."/>
     <div className="review-editor-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.6fr) minmax(250px,.8fr)', gap: 18, alignItems: 'start' }}>
      <form className="card" onSubmit={submit} style={{ padding: 23 }} data-testid="form-review">
         <div className="review-meta-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 14, marginBottom: 17 }}>
          <div><label className="label" htmlFor="review-title">Review title</label><input id="review-title" className="field" placeholder="e.g. Spring launch email" value={title} maxLength={120} onChange={e => setTitle(e.target.value)} required data-testid="input-review-title"/></div>
          <div><label className="label" htmlFor="review-channel">Channel</label><select id="review-channel" className="field" value={channel} onChange={e => setChannel(e.target.value)} data-testid="select-review-channel">{['Website','Email','Social','Paid ad','Product','Other'].map(c => <option key={c}>{c}</option>)}</select></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}><label className="label" htmlFor="review-content" style={{ margin: 0 }}>Copy to review</label><span className="mono" style={{ color: '#9ba1af' }}>{content.length.toLocaleString()} / 20,000</span></div>
        <textarea id="review-content" className="field" style={{ minHeight: 310, resize: 'vertical', lineHeight: 1.7 }} placeholder="Paste your draft here. Keep the original wording intact so findings can point to clear evidence." value={content} onChange={e => setContent(e.target.value)} maxLength={20000} required data-testid="textarea-review-content"/>
        {create.isError && <div style={{ color: '#aa4640', fontSize: 11, marginTop: 10 }} data-testid="error-create-review">{errorText(create.error)}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 17, gap: 12, flexWrap: 'wrap' }}><span style={{ color: '#8b92a4', fontSize: 10 }}>Submitting runs the currently enabled text rules.</span><button className="btn btn-primary" type="submit" disabled={create.isPending || !title.trim() || !content.trim()} data-testid="button-submit-review">{create.isPending ? 'Checking copy…' : <><ScanText size={15}/> Check against guidelines</>}</button></div>
      </form>
      <aside style={{ display: 'grid', gap: 12 }}>
        <div className="card" style={{ padding: 19, background: 'linear-gradient(150deg,#fff 42%,#f5f1ff)' }}><div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 11 }}><div style={{ width: 31, height: 31, borderRadius: 9, background: '#eee9fc', display: 'grid', placeItems: 'center', color: '#6c51b4' }}><Sparkles size={16}/></div><b style={{ font: '700 13px var(--app-font-display)', color: '#293552' }}>What gets checked</b></div><p style={{ fontSize: 11, color: '#727b91', lineHeight: 1.65, margin: 0 }}>Copy is matched to your enabled rules for tone, terminology, claims, messaging, disclaimers, accessibility, and visual guidance.</p></div>
        <div className="card" style={{ padding: 19 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#394560', fontSize: 12, fontWeight: 700, marginBottom: 10 }}><Shield size={15} color="#7058b5"/> Human decision, always</div><p style={{ fontSize: 11, color: '#7b8498', lineHeight: 1.65, margin: 0 }}>The system surfaces evidence and optional edits. It never approves or publishes content on your behalf.</p></div>
         <div className="card" style={{ padding: 19, borderColor: '#efe3cc', background: '#fffcf6' }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#725a35', fontSize: 12, fontWeight: 700, marginBottom: 8 }}><CircleHelp size={15}/> Limits to keep in mind</div><ul style={{ margin: 0, paddingLeft: 16, color: '#86795f', fontSize: 10, lineHeight: 1.75 }}><li>Detected claims remain unverified; no approved-source repository is connected.</li><li>Accessibility checks use text only and cannot assess complete accessibility.</li><li>Visual guidance is a labeled demo; pixel-level image comparison is unavailable.</li></ul></div>
      </aside>
    </div>
  </main>;
}

function DecisionForm({ review, compact = false }: { review: Review; compact?: boolean }) {
  const client = useQueryClient();
  const decide = useDecideInkloomReview();
  const [reviewer, setReviewer] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState<ReviewStatus>('Approved');
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewer.trim() || !reason.trim()) return;
    decide.mutate({ id: review.id, data: { status: status as 'Approved' | 'Needs Changes' | 'Dismissed', reviewer: reviewer.trim(), reason: reason.trim() } }, {
      onSuccess: updated => {
        client.invalidateQueries({ queryKey: getGetInkloomReviewQueryKey(review.id) });
        client.invalidateQueries({ queryKey: getListInkloomReviewsQueryKey() });
        client.invalidateQueries({ queryKey: getGetInkloomDashboardQueryKey() });
        setReviewer(''); setReason('');
      },
    });
  };
  return <form className="card" style={{ padding: compact ? 17 : 21 }} onSubmit={send} data-testid={`form-decision-${review.id}`}>
    <div style={{ font: '700 14px var(--app-font-display)', color: '#273451', marginBottom: 5 }}>Record a human decision</div>
    <div style={{ fontSize: 10, color: '#858da0', marginBottom: 15 }}>A reviewer and reason are required for every status decision.</div>
    <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 180px', gap: 12 }}>
      <div><label className="label" htmlFor={`reviewer-${review.id}`}>Reviewer</label><input id={`reviewer-${review.id}`} className="field" value={reviewer} onChange={e => setReviewer(e.target.value)} maxLength={100} placeholder="Your name" required data-testid={`input-reviewer-${review.id}`}/></div>
      <div><label className="label" htmlFor={`decision-${review.id}`}>Decision</label><select id={`decision-${review.id}`} className="field" value={status} onChange={e => setStatus(e.target.value as ReviewStatus)} data-testid={`select-decision-${review.id}`}><option>Approved</option><option>Needs Changes</option><option>Dismissed</option></select></div>
      <div style={{ gridColumn: compact ? 'auto' : '1 / -1' }}><label className="label" htmlFor={`reason-${review.id}`}>Reason</label><textarea id={`reason-${review.id}`} className="field" style={{ minHeight: 76, resize: 'vertical' }} value={reason} onChange={e => setReason(e.target.value)} maxLength={1000} placeholder="Add context for the audit trail…" required data-testid={`textarea-reason-${review.id}`}/></div>
    </div>
    {decide.isError && <div style={{ color: '#aa4640', fontSize: 11, marginTop: 10 }} data-testid={`error-decision-${review.id}`}>{errorText(decide.error)}</div>}
    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 13 }}><button className="btn btn-primary" type="submit" disabled={decide.isPending || !reviewer.trim() || !reason.trim()} data-testid={`button-save-decision-${review.id}`}>{decide.isPending ? 'Saving…' : <><CheckCheck size={14}/> Save decision</>}</button></div>
  </form>;
}

function ReviewDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const q = useGetInkloomReview(id, { query: { enabled: !!id, queryKey: getGetInkloomReviewQueryKey(id) } });
  if (q.isLoading) return <main className="page-wrap"><LoadingCards/></main>;
  if (q.isError || !q.data) return <main className="page-wrap"><QueryError message={errorText(q.error)} retry={() => q.refetch()}/></main>;
  const review = q.data;
  return <main className="page-wrap">
    <div style={{ marginBottom: 18 }}><Link href="/history" style={{ color: '#7a8194', textDecoration: 'none', display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 11 }} data-testid="link-back-history"><ChevronRight size={13} style={{ transform: 'rotate(180deg)' }}/> Review history</Link></div>
    <PageHeader eyebrow={`${review.channel} · ${fmtDate(review.createdAt)}`} title={review.title} subtitle="Evidence-led findings and a review decision, all in one place." action={<span className={statusClass(review.status)} data-testid={`status-detail-${review.id}`}>{review.status}</span>}/>
     <div className="review-detail-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.35fr) minmax(280px,.8fr)', gap: 17, alignItems: 'start' }}>
      <div style={{ display: 'grid', gap: 15 }}>
        <section className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h2 style={{ font: '700 14px var(--app-font-display)', color: '#283451', margin: 0 }}>Submitted copy</h2><span className="mono" style={{ color: '#9299a9' }}>{review.content.length} characters</span></div>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 12, color: '#535d75', background: '#fafafd', borderRadius: 9, border: '1px solid #eff0f5', padding: 16 }} data-testid={`text-review-content-${review.id}`}>{review.content}</div>
        </section>
        <section className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><div><h2 style={{ font: '700 14px var(--app-font-display)', color: '#283451', margin: 0 }}>Findings & evidence</h2><p style={{ fontSize: 10, color: '#8a91a4', margin: '5px 0 0' }}>Rule-based flags are signals for a person to assess.</p></div><span className="pill" style={{ background: '#f0edf8', color: '#67529d' }}>{review.findings?.length || 0} total</span></div>
          {review.findings?.length ? <div style={{ display: 'grid', gap: 11 }}>{review.findings.map(f => <article key={f.id} style={{ border: '1px solid #ececf3', borderRadius: 10, padding: 14 }} data-testid={`finding-${f.id}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><div style={{ display: 'flex', gap: 7, alignItems: 'center' }}><span className={severityClass(f.severity)}>{f.severity} signal</span><span style={{ color: '#59637b', fontSize: 10 }}>{f.type}</span></div><span className="pill" style={{ background: '#f2f3f7', color: '#70798e' }}>{f.status}</span></div>
            <div style={{ margin: '12px 0 8px', borderLeft: '2px solid #9c88db', padding: '5px 10px', background: '#f8f6fd', color: '#424d69', fontSize: 12, lineHeight: 1.6 }} data-testid={`text-evidence-${f.id}`}>“{f.evidence}”</div>
            <div style={{ color: '#69738a', fontSize: 11, lineHeight: 1.55 }}><b style={{ color: '#424d67' }}>Why flagged:</b> {f.explanation}</div>
            <div style={{ color: '#69738a', fontSize: 10, marginTop: 7 }}><b style={{ color: '#424d67' }}>Rule:</b> {f.rule}</div>
            <div style={{ marginTop: 11, padding: 10, background: '#f2f8f4', borderRadius: 8, color: '#4d715f', fontSize: 10, lineHeight: 1.5 }}><b>Optional suggestion</b><div style={{ marginTop: 3 }}>{f.suggestion}</div></div>
          </article>)}</div> : <div style={{ border: '1px solid #e8eee9', background: '#f7fbf8', borderRadius: 10, padding: 18, color: '#537461', fontSize: 11 }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: 7 }}/>No configured text-rule findings. This is not a guarantee that content is accurate or ready to publish.</div>}
        </section>
      </div>
      <div style={{ display: 'grid', gap: 14 }}>
        <DecisionForm review={review}/>
        <section className="card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '700 13px var(--app-font-display)', color: '#303b57', marginBottom: 12 }}><FileClock size={15} color="#725bb2"/> Decision audit</div>
          {review.auditLog?.length ? <div style={{ display: 'grid', gap: 13 }}>{[...review.auditLog].reverse().map(event => <div key={event.id} style={{ borderLeft: '2px solid #d8d0ed', paddingLeft: 12 }} data-testid={`audit-event-${event.id}`}><div style={{ fontSize: 11, fontWeight: 700, color: '#394460' }}>{event.actor} · {event.action}</div><div style={{ color: '#7c8498', fontSize: 9, marginTop: 3 }}>{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(event.at))}</div>{event.reason && <div style={{ color: '#667189', fontSize: 11, lineHeight: 1.6, marginTop: 7 }} data-testid={`text-audit-reason-${event.id}`}>{event.reason}</div>}</div>)}</div> : <div style={{ color: '#858da0', fontSize: 11, lineHeight: 1.6 }}>No audit events are recorded for this review yet.</div>}
        </section>
         <div className="card" style={{ padding: 17, background: '#fffaf1', borderColor: '#efe5d2', color: '#806e4d', fontSize: 10, lineHeight: 1.65 }} data-testid="notice-review-limit"><b>Review boundaries</b><br/>Detected claims remain unverified; no approved-source repository is connected. Accessibility checks are text-only. Visual guidance is a demo; no pixel-level image comparison is available. This workspace has no sign-in; do not submit confidential content.</div>
      </div>
    </div>
  </main>;
}

function Approvals() {
  const q = useListInkloomReviews();
  const pending = useMemo(() => q.data?.filter(r => r.status === 'Pending') || [], [q.data]);
  return <main className="page-wrap"><PageHeader eyebrow="Human review queue" title="Your call, not the model’s." subtitle="Every item here needs a named reviewer, a reason, and an explicit decision." action={<span className="pill pill-pending"><Clock3 size={12}/>{pending.length} awaiting</span>}/>
    {q.isLoading ? <LoadingCards/> : q.isError ? <QueryError message={errorText(q.error)} retry={() => q.refetch()}/> : pending.length === 0 ? <Empty label="Queue is clear" body="There are no pending reviews. New submissions will wait here for a human decision." action={<Link href="/review" className="btn btn-primary" data-testid="button-queue-submit">Submit content</Link>}/> :
     <div style={{ display: 'grid', gap: 14 }}>{pending.map((review, i) => <div className="card approval-row" key={review.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,.8fr) minmax(300px,1.2fr)', gap: 16, padding: 18, animationDelay: `${i * 45}ms` }} data-testid={`queue-review-${review.id}`}>
      <div><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><h2 style={{ margin: 0, font: '700 14px var(--app-font-display)', color: '#283451' }}>{review.title}</h2><span className="pill pill-pending">Pending</span></div><div style={{ marginTop: 7, color: '#888fa2', fontSize: 10 }}>{review.channel} · Submitted {fmtDate(review.createdAt)}</div><div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', color: '#6d7690', fontSize: 10 }}><ShieldAlert size={14} color="#a85e53"/>{review.findings?.filter(f => f.status === 'open').length || 0} open text-rule signals</div><div style={{ marginTop: 12, color: '#69738a', background: '#fafafd', borderRadius: 8, padding: 11, fontSize: 10, lineHeight: 1.6 }}>{review.content.slice(0, 210)}{review.content.length > 210 ? '…' : ''}</div><Link href={`/review/${review.id}`} className="btn" style={{ marginTop: 10 }} data-testid={`link-queue-detail-${review.id}`}><Eye size={13}/> Full evidence</Link></div>
      <DecisionForm review={review} compact/>
    </div>)}</div>}
  </main>;
}

function AllFindings() {
  const q = useListInkloomReviews();
  const [search, setSearch] = useState('');
  const [severity, setSeverity] = useState('All severities');
  const items = useMemo(() => (q.data || []).flatMap(r => r.findings.map(f => ({ ...f, review: r }))).filter(x => (severity === 'All severities' || x.severity === severity.toLowerCase()) && `${x.type} ${x.rule} ${x.evidence} ${x.explanation} ${x.review.title}`.toLowerCase().includes(search.toLowerCase())), [q.data, search, severity]);
  return <main className="page-wrap"><PageHeader eyebrow="Signals & suggestions" title="Findings" subtitle="Every flag is traceable to text evidence and a configurable rule. Suggestions are optional."/>
    <div className="card" style={{ padding: 13, display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
      <div style={{ position: 'relative', flex: '1 1 230px' }}><Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: '#9299aa' }}/><input className="field" style={{ paddingLeft: 34 }} placeholder="Search findings, rule, or review…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-findings"/></div>
      <select className="field" style={{ width: 180 }} value={severity} onChange={e => setSeverity(e.target.value)} data-testid="select-filter-severity">{['All severities','high','medium','low','info'].map(s => <option key={s}>{s === 'All severities' ? s : s[0].toUpperCase()+s.slice(1)}</option>)}</select>
      <span className="pill" style={{ alignSelf: 'center', background: '#f0edf8', color: '#66539a' }}><Filter size={12}/>{items.length} results</span>
    </div>
    {q.isLoading ? <LoadingCards/> : q.isError ? <QueryError message={errorText(q.error)} retry={() => q.refetch()}/> : items.length === 0 ? <Empty label="No findings match" body={search ? 'Try a different search or severity filter.' : 'Findings from submitted reviews will appear here.'}/> :
    <div style={{ display: 'grid', gap: 10 }}>{items.map(f => <article key={f.id} className="card" style={{ padding: 17 }} data-testid={`finding-card-${f.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><span className={severityClass(f.severity)}>{f.severity} signal</span><b style={{ color: '#35405c', fontSize: 12 }}>{f.type}</b><span style={{ color: '#a1a6b4', fontSize: 10 }}>Rule: {f.rule}</span></div><Link href={`/review/${f.review.id}`} className="btn" data-testid={`link-finding-review-${f.id}`}>{f.review.title}<ArrowRight size={13}/></Link></div>
      <div style={{ marginTop: 12, borderLeft: '2px solid #9c88db', padding: '6px 11px', background: '#f8f6fd', color: '#505b76', fontSize: 11, lineHeight: 1.55 }}>“{f.evidence}”</div>
      <div style={{ marginTop: 9, color: '#68738a', fontSize: 11 }}>{f.explanation}</div>
      <div style={{ display: 'flex', gap: 7, marginTop: 10, color: '#4e7560', background: '#f2f8f4', padding: 9, borderRadius: 7, fontSize: 10 }}><WandSparkles size={13}/><span><b>Optional suggestion</b> — {f.suggestion}</span></div>
    </article>)}</div>}
    <div style={{ marginTop: 17, color: '#928b70', background: '#fffaf0', border: '1px solid #efe5d2', borderRadius: 9, padding: 12, fontSize: 10, lineHeight: 1.6 }} data-testid="notice-findings-limits"><Info size={13} style={{ verticalAlign: 'middle', marginRight: 6 }}/> Findings are deterministic matches against enabled text rules, not factual verification. Accessibility checks are text-only; visual review is a labeled demo without pixel-level comparison.</div>
  </main>;
}

function HistoryPage() {
  const q = useListInkloomReviews();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All statuses');
  const reviews = useMemo(() => (q.data || []).filter(r => (filter === 'All statuses' || r.status === filter) && `${r.title} ${r.channel} ${r.reviewer || ''}`.toLowerCase().includes(search.toLowerCase())), [q.data, filter, search]);
  return <main className="page-wrap"><PageHeader eyebrow="Audit trail" title="Review history" subtitle="Find past submissions, inspect their evidence, and revisit human decisions." action={<Link href="/review" className="btn btn-primary" data-testid="button-history-new"><Plus size={14}/> New review</Link>}/>
    <div className="card" style={{ padding: 13, display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}><div style={{ position: 'relative', flex: '1 1 220px' }}><Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: '#9299aa' }}/><input className="field" style={{ paddingLeft: 34 }} value={search} onChange={e => setSearch(e.target.value)} placeholder="Search title, channel, reviewer…" data-testid="input-search-history"/></div><select className="field" style={{ width: 180 }} value={filter} onChange={e => setFilter(e.target.value)} data-testid="select-history-status">{['All statuses','Pending','Approved','Needs Changes','Dismissed'].map(s => <option key={s}>{s}</option>)}</select><span className="pill" style={{ alignSelf: 'center', background: '#f0edf8', color: '#66539a' }}>{reviews.length} reviews</span></div>
    {q.isLoading ? <LoadingCards/> : q.isError ? <QueryError message={errorText(q.error)} retry={() => q.refetch()}/> : reviews.length === 0 ? <Empty label="No reviews found" body={search ? 'Try another title, channel, or reviewer.' : 'Submitted content and its review trail will show up here.'} action={<Link href="/review" className="btn btn-primary" data-testid="button-history-empty">Submit first review</Link>}/> :
    <section className="card table-scroll" style={{ overflow: 'hidden' }}><table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}><thead><tr style={{ color: '#9198a9', fontSize: 9, textTransform: 'uppercase', letterSpacing: .8, background: '#fcfcfe' }}><th style={{ padding: '13px 12px 13px 19px' }}>Submission</th><th style={{ padding: 12 }}>Status</th><th style={{ padding: 12 }}>Reviewer</th><th style={{ padding: 12 }}>Signals</th><th style={{ padding: 12 }}>Updated</th><th/></tr></thead><tbody>{reviews.map((r, i) => <tr key={r.id} className="table-row" data-testid={`history-row-${r.id}`}><td style={{ padding: '14px 12px 14px 19px' }}><Link href={`/review/${r.id}`} style={{ color: '#293553', fontSize: 12, fontWeight: 600, textDecoration: 'none' }} data-testid={`history-title-${r.id}`}>{r.title}</Link><div style={{ color: '#8b92a4', fontSize: 10, marginTop: 4 }}>{r.channel} · Created {fmtDate(r.createdAt)}</div></td><td style={{ padding: 12 }}><span className={statusClass(r.status)}>{r.status}</span></td><td style={{ padding: 12, color: '#737c91', fontSize: 11 }}>{r.reviewer || '—'}</td><td style={{ padding: 12, color: '#737c91', fontSize: 11 }}>{r.findings.filter(f => f.status === 'open').length} open / {r.findings.length} total</td><td style={{ padding: 12, color: '#737c91', fontSize: 11 }}>{fmtDate(r.updatedAt)}</td><td style={{ padding: 12 }}><Link href={`/review/${r.id}`} className="btn btn-quiet" data-testid={`history-open-${r.id}`}><ArrowRight size={14}/></Link></td></tr>)}</tbody></table></section>}
  </main>;
}

type RuleFormProps = { rule?: BrandRule; onClose: () => void };
function RuleModal({ rule, onClose }: RuleFormProps) {
  const client = useQueryClient();
  const create = useCreateInkloomRule();
  const update = useUpdateInkloomRule();
  const [form, setForm] = useState<BrandRuleInput>({
    category: rule?.category || 'tone', name: rule?.name || '', description: rule?.description || '',
    pattern: rule?.pattern || '', replacement: rule?.replacement || '', severity: rule?.severity || 'medium', enabled: rule?.enabled ?? true,
  });
  const busy = create.isPending || update.isPending;
  const set = (key: keyof BrandRuleInput, val: string | boolean) => setForm(prev => ({ ...prev, [key]: val }));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form, replacement: form.replacement || null };
    const done = () => { client.invalidateQueries({ queryKey: getListInkloomRulesQueryKey() }); client.invalidateQueries({ queryKey: getGetInkloomDashboardQueryKey() }); onClose(); };
    if (rule) update.mutate({ id: rule.id, data: payload as BrandRuleUpdate }, { onSuccess: done });
    else create.mutate({ data: payload }, { onSuccess: done });
  };
  const error = create.error || update.error;
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="rule-modal-title" data-testid="modal-rule">
    <div style={{ padding: '19px 22px', borderBottom: '1px solid #ececf2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><div className="eyebrow">Guideline library</div><h2 id="rule-modal-title" style={{ margin: '4px 0 0', font: '700 18px var(--app-font-display)', color: '#25314e' }}>{rule ? 'Edit rule' : 'Create a rule'}</h2></div><button className="btn btn-quiet" onClick={onClose} aria-label="Close" data-testid="button-close-rule-modal"><X size={17}/></button></div>
    <form onSubmit={save} style={{ padding: 22, display: 'grid', gap: 13 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}><div><label className="label">Category</label><select className="field" value={form.category} onChange={e => set('category', e.target.value)} data-testid="select-rule-category">{categories.map(c => <option value={c} key={c}>{categoryName[c]}</option>)}</select></div><div><label className="label">Severity</label><select className="field" value={form.severity} onChange={e => set('severity', e.target.value)} data-testid="select-rule-severity">{['high','medium','low','info'].map(s => <option key={s}>{s}</option>)}</select></div></div>
      <div><label className="label">Rule name</label><input className="field" maxLength={120} value={form.name} onChange={e => set('name', e.target.value)} placeholder="A clear, specific name" required data-testid="input-rule-name"/></div>
      <div><label className="label">Description</label><textarea className="field" maxLength={1000} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Explain why this guidance matters." style={{ minHeight: 68 }} required data-testid="textarea-rule-description"/></div>
      <div><label className="label">Text pattern</label><input className="field" maxLength={300} value={form.pattern} onChange={e => set('pattern', e.target.value)} placeholder="Phrase or pattern the rule checks" required data-testid="input-rule-pattern"/><div style={{ color: '#939aab', fontSize: 9, marginTop: 5 }}>Deterministic matching against submitted text.</div></div>
      <div><label className="label">Optional suggested replacement</label><input className="field" value={form.replacement || ''} onChange={e => set('replacement', e.target.value)} placeholder="Leave blank if no edit is suggested" data-testid="input-rule-replacement"/></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#59637b', fontSize: 11 }}><input type="checkbox" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} data-testid="checkbox-rule-enabled"/> Rule is enabled</label>
      {error && <div style={{ color: '#aa4640', fontSize: 11 }} data-testid="error-rule-save">{errorText(error)}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, borderTop: '1px solid #eff0f4', paddingTop: 15 }}><button type="button" className="btn" onClick={onClose} data-testid="button-cancel-rule">Cancel</button><button className="btn btn-primary" disabled={busy} type="submit" data-testid="button-save-rule">{busy ? 'Saving…' : rule ? 'Save changes' : 'Create rule'}</button></div>
    </form>
  </div></div>;
}

function Guidelines() {
  const q = useListInkloomRules();
  const client = useQueryClient();
  const update = useUpdateInkloomRule();
  const remove = useDeleteInkloomRule();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All categories');
  const [modal, setModal] = useState<BrandRule | null | false>(false);
  const rules = useMemo(() => (q.data || []).filter(r => (category === 'All categories' || r.category === category) && `${r.name} ${r.description} ${r.pattern}`.toLowerCase().includes(search.toLowerCase())), [q.data, category, search]);
  const toggle = (r: BrandRule) => update.mutate({ id: r.id, data: { enabled: !r.enabled } }, { onSuccess: () => client.invalidateQueries({ queryKey: getListInkloomRulesQueryKey() }) });
  const deleteRule = (r: BrandRule) => { if (window.confirm(`Delete the rule “${r.name}”? This cannot be undone.`)) remove.mutate({ id: r.id }, { onSuccess: () => client.invalidateQueries({ queryKey: getListInkloomRulesQueryKey() }) }); };
  return <main className="page-wrap"><PageHeader eyebrow="Brand system" title="Guidelines" subtitle="The configurable rules behind every signal. Keep them specific, explainable, and current." action={<button className="btn btn-primary" onClick={() => setModal(null)} data-testid="button-create-rule"><Plus size={15}/> Add a rule</button>}/>
    <div style={{ background: '#f3f0fb', border: '1px solid #e7e0f6', borderRadius: 11, padding: '12px 14px', color: '#635886', fontSize: 10, lineHeight: 1.55, marginBottom: 15 }} data-testid="notice-guideline-demo"><Info size={14} style={{ verticalAlign: 'middle', marginRight: 6 }}/> Your saved rules are backend data. Findings are text-pattern matches; no approved-source repository is connected. Accessibility is text-only. Visual guidance is a demo with no pixel-level comparison.</div>
     <section className="card asset-demo-layout" style={{ padding: 17, marginBottom: 15, display: 'grid', gridTemplateColumns: 'minmax(190px,.8fr) minmax(250px,1.2fr)', gap: 17, alignItems: 'center' }} data-testid="section-approved-assets-demo">
       <div><div className="eyebrow">Visual consistency · demo</div><h2 style={{ margin: '5px 0 6px', font: '700 15px var(--app-font-display)', color: '#293552' }}>Approved logo &amp; brand asset</h2><p style={{ margin: 0, color: '#7a8296', fontSize: 10, lineHeight: 1.6 }}>A sample reference card for the brand asset library. This build does not compare uploaded images or detect logo misuse.</p></div>
       <div className="asset-preview-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 12, alignItems: 'center', border: '1px solid #eceaf3', borderRadius: 10, padding: 12, background: '#fbfaff' }}>
         <div style={{ minHeight: 64, display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid #efedf5', borderRadius: 8, padding: '10px 13px' }}><div className="brand-symbol"><Type size={18} strokeWidth={2.4}/></div><span style={{ font: '800 17px var(--app-font-display)', color: '#25274c', letterSpacing: '-.7px' }}>inkloom</span><span style={{ color: '#8875c0', font: '500 9px var(--app-font-mono)', marginLeft: -6 }}>AI</span></div>
         <div><div className="pill" style={{ background: '#fff5df', color: '#90621d' }}>DEMO</div><div style={{ marginTop: 5, color: '#747d93', fontSize: 9 }}>Sample approved wordmark</div></div>
         <div className="mono" style={{ gridColumn: '1 / -1', color: '#858ca0', overflowWrap: 'anywhere' }}>inkloom-primary-wordmark · light-background reference</div>
       </div>
     </section>
    <div className="card" style={{ padding: 13, display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}><div style={{ position: 'relative', flex: '1 1 220px' }}><Search size={15} style={{ position: 'absolute', left: 11, top: 11, color: '#9299aa' }}/><input className="field" style={{ paddingLeft: 34 }} placeholder="Search rules…" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-rules"/></div><select className="field" style={{ width: 200 }} value={category} onChange={e => setCategory(e.target.value)} data-testid="select-filter-category"><option>All categories</option>{categories.map(c => <option value={c} key={c}>{categoryName[c]}</option>)}</select><span className="pill" style={{ alignSelf: 'center', background: '#f0edf8', color: '#66539a' }}>{rules.length} rules</span></div>
    {q.isLoading ? <LoadingCards/> : q.isError ? <QueryError message={errorText(q.error)} retry={() => q.refetch()}/> : rules.length === 0 ? <Empty label="No rules here yet" body={search ? 'Try a different search or category.' : 'Add brand guidance to start evaluating copy.'} action={<button className="btn btn-primary" onClick={() => setModal(null)} data-testid="button-empty-create-rule"><Plus size={14}/> Create a rule</button>}/> :
     <div className="rule-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 11 }}>{rules.map((r, i) => <article className="card" key={r.id} style={{ padding: 16, animationDelay: `${i * 30}ms` }} data-testid={`rule-card-${r.id}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 9, alignItems: 'flex-start' }}><div style={{ minWidth: 0 }}><div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}><span className="pill" style={{ background: '#f1eef9', color: '#67569a' }}>{categoryName[r.category] || r.category}</span><span className={severityClass(r.severity)}>{r.severity}</span>{r.sample && <span className="pill" style={{ background: '#f4f5f8', color: '#778095' }}>Sample</span>}</div><h2 style={{ margin: '10px 0 5px', font: '700 13px var(--app-font-display)', color: '#2a3653' }}>{r.name}</h2></div><label title={r.enabled ? 'Disable rule' : 'Enable rule'} style={{ display: 'flex', alignItems: 'center', gap: 6, color: r.enabled ? '#448061' : '#969cac', fontSize: 9, cursor: 'pointer' }}><input type="checkbox" checked={r.enabled} onChange={() => toggle(r)} data-testid={`checkbox-toggle-rule-${r.id}`}/>{r.enabled ? 'On' : 'Off'}</label></div>
      <p style={{ color: '#707a91', fontSize: 10, lineHeight: 1.55, margin: '5px 0 12px' }}>{r.description}</p>
      <div style={{ display: 'grid', gap: 6, background: '#fafafd', border: '1px solid #f0f0f5', borderRadius: 8, padding: 10, fontSize: 10 }}><div><span style={{ color: '#9a9fb0' }}>Match </span><code className="mono" style={{ color: '#5d6380', overflowWrap: 'anywhere' }}>{r.pattern}</code></div><div><span style={{ color: '#9a9fb0' }}>Optional suggestion </span><span style={{ color: '#50745f' }}>{r.replacement || 'None provided'}</span></div></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 5, marginTop: 10 }}><button className="btn btn-quiet" onClick={() => setModal(r)} data-testid={`button-edit-rule-${r.id}`}><Pencil size={13}/> Edit</button><button className="btn btn-quiet" style={{ color: '#ad5551' }} onClick={() => deleteRule(r)} disabled={remove.isPending} data-testid={`button-delete-rule-${r.id}`}><Trash2 size={13}/> Delete</button></div>
    </article>)}</div>}
    {modal !== false && <RuleModal rule={modal || undefined} onClose={() => setModal(false)}/>}
  </main>;
}

function Router() {
  const [path] = useLocation();
  return <ErrorBoundary resetKey={path}><Shell><Switch>
    <Route path="/" component={Dashboard}/>
    <Route path="/review" component={Editor}/>
    <Route path="/review/:id" component={ReviewDetail}/>
    <Route path="/guidelines" component={Guidelines}/>
    <Route path="/findings" component={AllFindings}/>
    <Route path="/history" component={HistoryPage}/>
    <Route path="/approvals" component={Approvals}/>
    <Route component={NotFound}/>
  </Switch></Shell></ErrorBoundary>;
}
function NotFound() {
  return <main className="page-wrap"><Empty label="This page isn’t in the workspace" body="Use the navigation to return to reviews, findings, or your brand guidelines." action={<Link href="/" className="btn btn-primary" data-testid="link-home">Go to overview</Link>}/></main>;
}
function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><Router/><Toaster/></TooltipProvider></QueryClientProvider>;
}
export default App;
