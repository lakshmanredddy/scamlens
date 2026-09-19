(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const samples = {
    bank: 'URGENT: Your bank account will be suspended today. Complete KYC immediately at https://bank-verification-example.com/kyc and share the OTP with our support team.',
    job: 'Congratulations! You have been selected for a work-from-home job paying ₹45,000/month. Pay ₹999 registration fee today to confirm your position. Limited seats available.',
    delivery: 'Your parcel could not be delivered. Pay ₹25 redelivery fee within 30 minutes using https://parcel-update-example.xyz/track to avoid cancellation.'
  };
  const state = { type: 'message', file: null };

  function toast(message) {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function extractUrls(text) { return String(text).match(/https?:\/\/[^\s<]+/gi) || []; }

  function urlSignals(raw) {
    let u;
    try { u = new URL(raw.trim()); } catch { return [{name:'Invalid URL', detail:'The supplied value is not a valid URL.', level:'high'}]; }
    const host = u.hostname.toLowerCase(); const signals = [];
    if (u.protocol !== 'https:') signals.push({name:'No HTTPS',detail:'The URL does not use HTTPS.',level:'medium'});
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) signals.push({name:'IP-based destination',detail:'The link uses an IP address instead of a recognizable domain.',level:'high'});
    if (host.includes('xn--')) signals.push({name:'Punycode domain',detail:'The hostname contains punycode and deserves extra verification.',level:'high'});
    if (host.length > 35) signals.push({name:'Long hostname',detail:'An unusually long hostname can make impersonation harder to notice.',level:'medium'});
    if ((host.match(/\./g)||[]).length >= 3) signals.push({name:'Many subdomains',detail:'Multiple subdomains can obscure the meaningful domain.',level:'medium'});
    if (/@/.test(raw)) signals.push({name:'@ character',detail:'The URL contains an @ character, a pattern sometimes used to disguise destinations.',level:'high'});
    if (/\.(?:xyz|top|click|shop|buzz|work|live)(?:$|\/)/i.test(host)) signals.push({name:'Unfamiliar TLD',detail:'This top-level domain alone does not prove fraud, but it increases the need for verification.',level:'medium'});
    if (/(login|verify|secure|account|kyc|claim|refund|payment|wallet|bonus|prize)/i.test(raw)) signals.push({name:'Sensitive-action wording',detail:'The URL contains terms commonly associated with account or payment actions.',level:'medium'});
    return signals;
  }

  function analyze(text, type = state.type) {
    const input = String(text || '').trim();
    const lower = input.toLowerCase();
    const indicators = [];
    const add = (name, detail, evidence, level='high') => indicators.push({name, detail, evidence, level});
    if (!input) return {score:0,label:'NO INPUT',summary:'Add content to start an analysis.',category:'Unknown',indicators:[],timeline:[],evidence:[],actions:['Add a message, URL, or QR destination and analyze it again.']};
    if (/(urgent|immediately|act now|within \d+ ?(minutes?|hours?)|expires today|last chance|limited time|suspended today)/i.test(input)) add('Artificial urgency','The content pressures the recipient to act quickly before they can independently verify the request.',input.match(/[^.!?]*(urgent|immediately|act now|within \d+ ?(minutes?|hours?)|expires today|last chance|limited time|suspended today)[^.!?]*/i)?.[0] || 'Urgent wording detected.');
    if (/(otp|one[- ]time password|pin|password|cvv|card number|verification code|login details)/i.test(input)) add('Credential request','The content asks for authentication or payment credentials that should not be shared with unsolicited contacts.',input.match(/[^.!?]*(otp|one[- ]time password|pin|password|cvv|card number|verification code|login details)[^.!?]*/i)?.[0] || 'Credential-related wording detected.');
    if (/(pay|payment|processing fee|registration fee|deposit|send money|transfer|₹|rs\.?\s?\d+)/i.test(input)) add('Payment request','The content requests money, a fee, or a transfer as part of the interaction.',input.match(/[^.!?]*(pay|payment|processing fee|registration fee|deposit|send money|transfer|₹|rs\.?\s?\d+)[^.!?]*/i)?.[0] || 'Payment-related wording detected.');
    if (/(won|winner|prize|reward|lottery|selected|cashback|refund|free money)/i.test(input)) add('Unexpected reward or benefit','Unexpected rewards and refunds are frequently used to make a fraudulent request seem attractive.',input.match(/[^.!?]*(won|winner|prize|reward|lottery|selected|cashback|refund|free money)[^.!?]*/i)?.[0] || 'Reward language detected.','medium');
    if (/(bank|sbi|hdfc|icici|axis|amazon|flipkart|courier|customs|government|income tax|police|support team)/i.test(input) && /(verify|suspend|blocked|kyc|account|fee|otp|click)/i.test(input)) add('Possible impersonation','The message invokes a recognizable organization or authority while requesting an action or sensitive information.',input.match(/[^.!?]*(bank|sbi|hdfc|icici|axis|amazon|flipkart|courier|customs|government|income tax|police|support team)[^.!?]*/i)?.[0] || 'Organization-related language detected.','high');
    const urls = extractUrls(input);
    urls.forEach(url => urlSignals(url).forEach(s => add(`URL: ${s.name}`,s.detail,url,s.level)));
    if (/(click|tap|open|visit|follow)\s+(here|this|the link|now)/i.test(input)) add('Action link prompt','The recipient is directed to an external destination as part of the request.',input.match(/[^.!?]*(click|tap|open|visit|follow)[^.!?]*/i)?.[0] || 'External action prompt detected.','medium');
    if (/(job|work from home|salary|registration fee|selected for)/i.test(input)) add('Job-offer pattern','The message resembles a recruitment offer combined with a fee, urgency, or unusual request.',input.match(/[^.!?]*(job|work from home|salary|registration fee|selected for)[^.!?]*/i)?.[0] || 'Job-offer language detected.','high');
    if (/(kyc|account.*suspend|bank.*block)/i.test(lower)) add('KYC / account-threat pattern','Threats about account suspension combined with verification requests are a common social-engineering pattern.',input.match(/[^.!?]*(kyc|account.*suspend|bank.*block)[^.!?]*/i)?.[0] || 'KYC/account threat detected.','high');

    const unique = indicators.filter((x,i,a) => a.findIndex(y => y.name === x.name) === i);
    let score = Math.min(97, unique.reduce((n,x) => n + (x.level === 'high' ? 19 : 10), 0));
    if (urls.length) score += Math.min(12, urls.length * 4);
    if (type === 'url' && !unique.length) score = Math.min(35, score + 15);
    score = Math.min(97, score);
    const label = score >= 70 ? 'HIGH RISK' : score >= 40 ? 'REVIEW CAREFULLY' : 'LOW INDICATORS';
    const category = /job|work from home|salary/i.test(input) ? 'Possible job scam' : /kyc|bank|otp|account/i.test(input) ? 'Possible phishing / impersonation' : /prize|winner|lottery/i.test(input) ? 'Possible prize scam' : /payment|refund|delivery|parcel/i.test(input) ? 'Possible payment / delivery scam' : 'Suspicious digital interaction';
    const timeline = unique.length ? [
      ['CLAIM','A trusted identity or attractive benefit is presented.'],
      ['PRESSURE','Urgency, fear or scarcity reduces time for verification.'],
      ['ACTION','The user is directed to click, pay or respond.'],
      ['DATA / MONEY','Credentials, codes, documents or funds may be requested.'],
      ['POTENTIAL LOSS','Following the request could expose the user to fraud.']
    ] : [['INPUT','Content submitted for review.'],['SIGNALS','No strong local indicators found.'],['VERIFY','Independently verify the sender and destination.']];
    const evidence = unique.slice(0,6).map(x => ({title:x.name, evidence:x.evidence, explanation:x.detail}));
    const actions = score >= 70 ? ['Do not click or reply until the request is independently verified.','Never share OTPs, PINs, passwords or card security codes with unsolicited contacts.','Verify the organization through its official app, website or known contact channel.','If money or credentials were already shared, contact the relevant service provider immediately and preserve evidence.'] : ['Verify the sender and destination independently before acting.','Avoid sharing credentials or making payments based only on an unsolicited message.','If the request involves an account, open the organization’s official app/site yourself rather than using the supplied link.'];
    return {score,label,summary: score >= 70 ? 'Multiple signals associated with social engineering or fraud were detected. Treat the content as untrusted until independently verified.' : score >= 40 ? 'Some suspicious patterns were detected. Verify the sender, request and destination independently before acting.' : 'No strong fraud indicators were found by the local rules. A low indicator score is not proof that content is safe.',category,indicators:unique,timeline,evidence,actions,urls};
  }

  function render(result) {
    $('#riskLabel').textContent = result.label;
    $('#riskLabel').style.color = result.score >= 70 ? 'var(--bad)' : result.score >= 40 ? 'var(--warn)' : 'var(--good)';
    $('#riskSummary').textContent = result.summary;
    $('#riskScore').textContent = result.score;
    $('#resultTitle').textContent = result.category;
    $('#indicatorCount').textContent = `${result.indicators.length} signal${result.indicators.length===1?'':'s'}`;
    $('#indicators').innerHTML = result.indicators.length ? result.indicators.map(x => `<div class="indicator ${x.level}"><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.detail)}</small></div>`).join('') : '<div class="indicator"><b>No strong local indicators</b><small>Use independent verification before trusting the content.</small></div>';
    $('#timeline').innerHTML = result.timeline.map(x => `<div class="timeline-item"><strong>${escapeHtml(x[0])}</strong><span>${escapeHtml(x[1])}</span></div>`).join('');
    $('#evidence').innerHTML = result.evidence.length ? result.evidence.map(x => `<div class="evidence"><b>${escapeHtml(x.title)}</b><p><strong>Evidence:</strong> ${escapeHtml(x.evidence)}</p><p>${escapeHtml(x.explanation)}</p></div>`).join('') : '<div class="evidence"><b>No evidence signals</b><p>The current local rules did not identify a strong indicator.</p></div>';
    $('#actions').innerHTML = result.actions.map(x => `<li>${escapeHtml(x)}</li>`).join('');
    $('#scanId').textContent = `#SL-${Math.random().toString(36).slice(2,8).toUpperCase()}`;
    $('#results').classList.remove('hidden');
    $('#results').scrollIntoView({behavior:'smooth',block:'start'});
    state.lastResult = result;
  }

  function getInput() {
    if (state.type === 'message') return $('#messageText').value;
    if (state.type === 'url' || state.type === 'qr') return $('#urlText').value || $('#qrText').value;
    if (state.type === 'screenshot') return state.file ? `Screenshot filename: ${state.file.name}` : '';
    return '';
  }

  $$('.tab').forEach(tab => tab.addEventListener('click', () => {
    state.type = tab.dataset.type; $$('.tab').forEach(t => t.classList.toggle('active', t === tab));
    $$('.input-view').forEach(v => v.classList.add('hidden'));
    const id = state.type === 'message' ? 'message-input' : `${state.type}-input`; const view = $(`#${id}`); if (view) view.classList.remove('hidden');
    if (state.type === 'url' || state.type === 'qr') $('#url-input')?.classList.toggle('hidden', state.type !== 'url');
    if (state.type === 'qr') $('#qr-input')?.classList.remove('hidden');
  }));
  $$('[data-scroll]').forEach(b => b.addEventListener('click', () => $(b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));
  $$('.chip').forEach(b => b.addEventListener('click', () => { $('#messageText').value = samples[b.dataset.sample] || ''; toast('Demo example loaded.'); }));
  $('#analyzeBtn').addEventListener('click', () => {
    const text = getInput();
    if (state.type === 'screenshot' && !state.file) return toast('Choose a screenshot first.');
    if (!text) return toast('Add content before analyzing.');
    const btn = $('#analyzeBtn'); btn.disabled = true; btn.innerHTML = 'Analyzing <span>…</span>';
    setTimeout(() => { render(analyze(text)); btn.disabled = false; btn.innerHTML = 'Analyze content <span>→</span>'; }, 650);
  });
  $('#chooseFile').addEventListener('click', () => $('#imageFile').click());
  $('#imageFile').addEventListener('change', e => { const f=e.target.files?.[0] || null; if(f && /^image\/(png|jpeg|webp)$/.test(f.type) && f.size <= 8*1024*1024){state.file=f;$('#fileName').textContent=f.name;} else {state.file=null;$('#fileName').textContent=''; if(f) toast('Use a PNG, JPG or WEBP image up to 8 MB.');} });
  $('#dropzone').addEventListener('dragover', e => { e.preventDefault(); $('#dropzone').style.borderColor='var(--accent)'; });
  $('#dropzone').addEventListener('dragleave', () => $('#dropzone').style.borderColor='');
  $('#dropzone').addEventListener('drop', e => { e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f && /^image\/(png|jpeg|webp)$/.test(f.type) && f.size <= 8*1024*1024){state.file=f;$('#fileName').textContent=f.name;}else toast('Use a PNG, JPG or WEBP image up to 8 MB.'); });
  $('#newScan').addEventListener('click', () => { $('#results').classList.add('hidden'); $('#scanner').scrollIntoView({behavior:'smooth'}); });
  function loadHistory() {
    const history = JSON.parse(localStorage.getItem('scamlens_history') || '[]');
    const high = history.filter(x => x.score >= 70).length; const review = history.filter(x => x.score >= 40 && x.score < 70).length; const low = history.filter(x => x.score < 40).length;
    $('#totalScans').textContent = history.length; $('#highScans').textContent = high; $('#reviewScans').textContent = review; $('#lowScans').textContent = low;
    const list = $('#historyList');
    list.innerHTML = history.length ? history.slice(0,10).map((x,i) => { const cls=x.score>=70?'high':x.score>=40?'review':'low'; const when=new Date(x.savedAt).toLocaleString(); return `<div class=\"history-row\"><div><strong>${escapeHtml(x.category)}</strong><small>${escapeHtml(when)} · ${escapeHtml(String(x.score))}/100</small></div><span class=\"history-badge ${cls}\">${escapeHtml(x.label)}</span><span>${escapeHtml(String(x.indicators?.length || 0))} signals</span><span>${escapeHtml(x.urls?.length ? 'URL checked' : 'Content')}</span></div>`; }).join('') : '<div class=\"empty-history\">No saved scans yet. Run an analysis and choose “Save report”.</div>';
  }
  $('#saveReport').addEventListener('click', () => { const history=JSON.parse(localStorage.getItem('scamlens_history')||'[]'); history.unshift({...state.lastResult, savedAt:new Date().toISOString()}); localStorage.setItem('scamlens_history',JSON.stringify(history.slice(0,20))); loadHistory(); toast('Report saved locally in this browser.'); });
  $('#clearHistory').addEventListener('click', () => { localStorage.removeItem('scamlens_history'); loadHistory(); toast('Local scan history cleared.'); });
  loadHistory();
  $('#downloadReport').addEventListener('click', () => { if(!state.lastResult)return; const r=state.lastResult; const text=`SCAMLENS SECURITY REPORT\n\nAssessment: ${r.label}\nRisk indicator: ${r.score}/100\nCategory: ${r.category}\n\nSUMMARY\n${r.summary}\n\nINDICATORS\n${r.indicators.map(x=>`- ${x.name}: ${x.detail} Evidence: ${x.evidence}`).join('\n')}\n\nSAFETY ACTIONS\n${r.actions.map(x=>`- ${x}`).join('\n')}\n`; const blob=new Blob([text],{type:'text/plain'}); const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='scamlens-report.txt';a.click();URL.revokeObjectURL(a.href); });
  // Keep the QR tab using its own field while preserving the shared URL analyzer.
  const qrTab = $('.tab[data-type="qr"]'); if (qrTab) qrTab.addEventListener('click',()=>{$$('.input-view').forEach(v=>v.classList.add('hidden'));$('#qr-input').classList.remove('hidden');});
})();
