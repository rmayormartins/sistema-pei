/* ==========================================================
   Sistema PAEE + PEI · Lógica frontend
   ========================================================== */

// CONFIGURAÇÃO. Trocar pela URL do seu Cloudflare Worker.
const WORKER_URL = "https://sistema-pei-worker.rmayormartins.workers.dev/generate";

let currentStep = 1;
let lastGeneratedDoc = null;
let lastInputs = null;

// ==========================================================
// Navegação
// ==========================================================
function goToStep(n) {
  if (n > currentStep) {
    if (currentStep === 1 && !validateForm("form-plano")) return;
    if (currentStep === 2 && !validateForm("form-caso")) return;
  }
  document.querySelectorAll(".step-panel").forEach(p => { p.classList.remove("active"); p.hidden = true; });
  document.querySelectorAll(".step-tab").forEach(t => {
    t.classList.remove("active");
    const step = parseInt(t.dataset.step);
    if (step < n) t.classList.add("completed"); else t.classList.remove("completed");
  });
  const panel = document.getElementById(`step-${n}`);
  panel.hidden = false; panel.classList.add("active");
  document.querySelector(`.step-tab[data-step="${n}"]`).classList.add("active");
  currentStep = n;
  window.scrollTo({ top: document.querySelector(".stepper").offsetTop - 80, behavior: "smooth" });
  saveLocal();
}

function validateForm(formId) {
  const form = document.getElementById(formId);
  const required = form.querySelectorAll("[required]");
  let firstInvalid = null;
  required.forEach(el => {
    if (!el.value.trim()) { el.style.borderColor = "var(--color-error)"; if (!firstInvalid) firstInvalid = el; }
    else el.style.borderColor = "";
  });
  if (firstInvalid) { firstInvalid.focus(); alert("Preencha os campos obrigatórios (marcados com *)."); return false; }
  return true;
}

function collectFormData(formId) {
  const form = document.getElementById(formId);
  const data = {};
  form.querySelectorAll("input, select, textarea").forEach(el => { if (el.name) data[el.name] = el.value.trim(); });
  return data;
}

// ==========================================================
// Persistência local
// ==========================================================
function saveLocal() {
  const state = { plano: collectFormData("form-plano"), caso: collectFormData("form-caso"), doc: lastGeneratedDoc, step: currentStep, ts: Date.now() };
  try { localStorage.setItem("sistema-pei-state", JSON.stringify(state)); } catch (e) { console.warn(e); }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem("sistema-pei-state");
    if (!raw) return;
    const state = JSON.parse(raw);
    if (Date.now() - state.ts > 7 * 24 * 60 * 60 * 1000) { localStorage.removeItem("sistema-pei-state"); return; }
    Object.entries(state.plano || {}).forEach(([k, v]) => { const el = document.querySelector(`#form-plano [name="${k}"]`); if (el) el.value = v; });
    Object.entries(state.caso || {}).forEach(([k, v]) => { const el = document.querySelector(`#form-caso [name="${k}"]`); if (el) el.value = v; });
    if (state.doc) { lastGeneratedDoc = state.doc; renderDoc(state.doc); }
  } catch (e) { console.warn(e); }
}

// ==========================================================
// Exemplo: TEA, 5º ano, Língua Portuguesa
// ==========================================================
function loadExample() {
  const example = {
    plano: {
      disciplina: "Língua Portuguesa", ano: "5º ano", turma: "5A", quantidade_aulas: "bloco de 3 aulas",
      docente: "Profa. exemplo", prof_aee: "Profa. AEE exemplo",
      conteudo: "Gêneros textuais – parlendas, trava-línguas e quadrinhas. Estrutura rítmica, rimas, repetições, leitura fluente e produção textual.",
      objetivos: "Desenvolver fluência leitora; reconhecer padrões rítmicos e sonoros; produzir pequenos textos no gênero parlenda. BNCC: EF05LP09.",
      metodologia: "Leitura coletiva em voz alta, atividades em duplas, produção textual, dramatização de parlendas.",
      avaliacao: "Observação contínua, leitura oral, produção textual escrita.",
      recursos: "Livro didático, lousa, cartões impressos, sala de recursos multifuncional."
    },
    caso: {
      nome: "Estudante exemplo", data_nascimento: "2014-03-15", ano_turma: "5º ano A", escola: "EMEF Exemplo",
      tipo_deficiencia: "TEA", cid_dsm: "F84.0", prof_regente: "Profa. exemplo",
      desenvolvimento_linguagem: "Linguagem oral funcional, vocabulário restrito a temas de interesse. Dificuldade com linguagem figurada.",
      desenvolvimento_motor: "Marcos motores dentro do esperado. Coordenação motora fina em desenvolvimento, escrita pouco firme.",
      desenvolvimento_cognitivo: "Boa memória visual e auditiva. Reconhece padrões com facilidade quando apresentados visualmente.",
      desenvolvimento_social: "Interage com pares específicos. Rotinas estabelecidas, pode reagir com ansiedade a mudanças inesperadas.",
      habilidades_interesses: "Memória visual e auditiva fortes. Gosta de música, ritmos repetitivos e atividades com cartões.",
      dificuldades: "Fluência leitora limitada, copia frases mais do que produz autonomamente. Dificuldade em identificar rimas só pela escuta. Cansaço em tarefas longas.",
      interesses_motivadores: "Dinossauros, trens, músicas com repetição.",
      estilo_aprendizagem: "visual",
      formas_comunicacao: "Oral, apoio visual",
      barreiras_curriculo: "Atividades longas de escrita, instruções apenas orais, ambientes com muito ruído.",
      disciplinas_adaptacao: "Língua Portuguesa, especialmente produção textual.",
      estrategias_funcionaram: "Cartões visuais, rotina previsível, blocos curtos de atividade, uso dos temas de interesse.",
      suporte_observacoes: "",
      responsavel_contato: "Mãe – (00) 90000-0000",
      forma_comunicacao_familia: "Agenda escolar e WhatsApp",
      info_familia: "Família relata hiperfoco em dinossauros e boa resposta a músicas em casa."
    }
  };
  Object.entries(example.plano).forEach(([k, v]) => { const el = document.querySelector(`#form-plano [name="${k}"]`); if (el) el.value = v; });
  Object.entries(example.caso).forEach(([k, v]) => { const el = document.querySelector(`#form-caso [name="${k}"]`); if (el) el.value = v; });
  alert("Exemplo carregado: estudante do 5º ano com TEA, Língua Portuguesa.");
}

// ==========================================================
// Geração
// ==========================================================
async function generatePEI() {
  if (!validateForm("form-caso")) return;
  goToStep(3);
  const plano = collectFormData("form-plano");
  const caso = collectFormData("form-caso");
  lastInputs = { plano_ensino: plano, estudo_caso: caso };

  document.getElementById("generation-loading").hidden = false;
  document.getElementById("generation-error").hidden = true;
  document.getElementById("pei-result").hidden = true;
  document.getElementById("result-actions").hidden = true;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(lastInputs)
    });
    if (!response.ok) { const errText = await response.text(); throw new Error(`Erro ${response.status}: ${errText}`); }
    const doc = await response.json();
    if (doc.error) throw new Error(doc.error);
    lastGeneratedDoc = doc;
    renderDoc(doc);
    saveLocal();
  } catch (err) {
    console.error(err);
    document.getElementById("generation-loading").hidden = true;
    document.getElementById("generation-error").hidden = false;
    document.getElementById("error-message").textContent = err.message + ". Verifique sua conexão e a configuração do Worker.";
  }
}

function regeneratePEI() { generatePEI(); }

// ==========================================================
// Renderização
// ==========================================================
function renderDoc(doc) {
  document.getElementById("generation-loading").hidden = true;
  document.getElementById("generation-error").hidden = true;
  document.getElementById("pei-result").hidden = false;
  document.getElementById("result-actions").hidden = false;

  document.querySelectorAll(".pei-input[data-field]").forEach(el => {
    const path = el.dataset.field.split(".");
    let value = doc;
    for (const key of path) { value = value?.[key]; if (value === undefined || value === null) break; }
    el.textContent = (value === undefined || value === null) ? "" : value;
  });

  const fundamentacao = doc.fundamentacao || [];
  const ul = document.getElementById("pei-fundamentacao");
  ul.innerHTML = "";
  fundamentacao.forEach(item => { const li = document.createElement("li"); li.textContent = item; ul.appendChild(li); });

  document.querySelectorAll(".pei-input[data-field]").forEach(el => {
    el.removeEventListener("blur", peiInputChangeHandler);
    el.addEventListener("blur", peiInputChangeHandler);
  });
}

function peiInputChangeHandler(e) {
  if (!lastGeneratedDoc) return;
  const path = e.target.dataset.field.split(".");
  const value = e.target.textContent.trim();
  let obj = lastGeneratedDoc;
  for (let i = 0; i < path.length - 1; i++) { if (!obj[path[i]]) obj[path[i]] = {}; obj = obj[path[i]]; }
  obj[path[path.length - 1]] = value;
  saveLocal();
}

function readDocFromDOM() {
  const doc = JSON.parse(JSON.stringify(lastGeneratedDoc || {}));
  document.querySelectorAll(".pei-input[data-field]").forEach(el => {
    const path = el.dataset.field.split(".");
    let obj = doc;
    for (let i = 0; i < path.length - 1; i++) { if (!obj[path[i]]) obj[path[i]] = {}; obj = obj[path[i]]; }
    obj[path[path.length - 1]] = el.textContent.trim();
  });
  return doc;
}

// ==========================================================
// Exportação PDF
// ==========================================================
function exportPDF() {
  if (!lastGeneratedDoc) { alert("Nenhum documento para exportar."); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - 2 * margin;
  let y = margin;
  const d = readDocFromDOM();

  doc.setFillColor(45, 80, 22);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17); doc.setFont("helvetica", "bold");
  doc.text("Instrumento Pedagógico Integrado · PAEE + PEI", margin, 38);
  doc.setFontSize(8.5); doc.setFont("helvetica", "normal");
  doc.text("Portaria MEC nº 421/2026 · Art. 7 §2 · Parecer CNE/CP 50/2023", margin, 58);
  y = 110;
  doc.setTextColor(26, 31, 24);

  function ensureSpace(h) { if (y + h > pageH - margin) { doc.addPage(); y = margin; } }
  function sectionTitle(t, sub) {
    ensureSpace(46);
    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(45, 80, 22);
    doc.text(t, margin, y);
    doc.setDrawColor(82, 123, 62); doc.setLineWidth(1); doc.line(margin, y + 4, margin + contentW, y + 4);
    y += 16;
    if (sub) { doc.setFontSize(7.5); doc.setFont("helvetica", "italic"); doc.setTextColor(120, 120, 120); doc.text(doc.splitTextToSize(sub, contentW), margin, y); y += 12; }
    y += 6; doc.setTextColor(26, 31, 24);
  }
  function fieldBlock(label, value) {
    if (!value) return;
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(74, 83, 65);
    doc.text(label.toUpperCase(), margin, y); y += 14;
    doc.setFontSize(10.5); doc.setFont("helvetica", "normal"); doc.setTextColor(26, 31, 24);
    const lines = doc.splitTextToSize(value, contentW);
    ensureSpace(lines.length * 13 + 10);
    doc.text(lines, margin, y); y += lines.length * 13 + 10;
  }

  sectionTitle("Identificação");
  [["Discente", d.identificacao?.discente], ["Escola", d.identificacao?.escola], ["Disciplina", d.identificacao?.disciplina],
   ["Ano / Turma", d.identificacao?.ano_turma], ["Quantidade de aulas", d.identificacao?.quantidade_aulas],
   ["Tipo de deficiência / condição", d.identificacao?.tipo_deficiencia], ["Prof. Regente", d.identificacao?.prof_regente],
   ["Prof. do AEE", d.identificacao?.prof_aee]].forEach(([l, v]) => fieldBlock(l, v));

  sectionTitle("PAEE · Plano de Atendimento Educacional Especializado", "Preenchido pelo professor do AEE (Art. 10). A IA não preenche esta seção.");
  fieldBlock("Barreiras identificadas", d.paee?.barreiras_identificadas || "________________________________________________");
  fieldBlock("Materiais e recursos", d.paee?.materiais_recursos || "________________________________________________");
  fieldBlock("Tecnologia assistiva e CAA", d.paee?.tecnologia_assistiva || "________________________________________________");
  fieldBlock("Profissional de apoio escolar", d.paee?.profissional_apoio || "________________________________________________");
  fieldBlock("Demandas de formação e rede de proteção", d.paee?.rede_protecao || "________________________________________________");

  sectionTitle("PEI · Plano Educacional Individualizado", "Sugerido pela IA · Art. 11, Portaria 421/2026 · revisar antes de oficializar.");
  fieldBlock("Acessibilidade de conteúdo", d.pei?.acessibilidade_conteudo);
  fieldBlock("Objetivos específicos", d.pei?.objetivos_especificos);
  fieldBlock("Metodologia e recursos", d.pei?.metodologia_recursos);
  fieldBlock("Medidas de acessibilidade avaliativa", d.pei?.medidas_acessibilidade_avaliativa);
  fieldBlock("Indicadores de progresso", d.pei?.indicadores_progresso);
  fieldBlock("Estratégia de acompanhamento", d.pei?.estrategia_acompanhamento);
  fieldBlock("Parecer avaliativo · antes", d.pei?.parecer_avaliativo?.antes);
  fieldBlock("Parecer avaliativo · após", d.pei?.parecer_avaliativo?.depois || "A preencher após a execução do bloco de aulas.");
  fieldBlock("Devolutiva à família", d.pei?.devolutiva_familia);

  if (d.observacoes_pedagogicas) { sectionTitle("Observações pedagógicas"); fieldBlock("", d.observacoes_pedagogicas); }
  if (d.fundamentacao?.length) { sectionTitle("Fundamentação"); d.fundamentacao.forEach(f => fieldBlock("·", f)); }

  ensureSpace(40);
  doc.setFontSize(8); doc.setTextColor(111, 122, 102); doc.setFont("helvetica", "italic");
  doc.text(doc.splitTextToSize("A seção PEI foi gerada com apoio de IA e revisada pelo professor regente. O PAEE é de responsabilidade do professor do AEE. Não substitui avaliação multidisciplinar.", contentW), margin, y);
  y += 34;

  ensureSpace(50);
  doc.setDrawColor(74, 83, 65); doc.setLineWidth(0.5);
  const w3 = (contentW - 40) / 3;
  const xs = [margin, margin + w3 + 20, margin + 2 * (w3 + 20)];
  xs.forEach(x => doc.line(x, y + 20, x + w3, y + 20));
  doc.setFontSize(8); doc.setFont("helvetica", "normal");
  doc.text("Prof. do AEE", xs[0] + 5, y + 33);
  doc.text("Prof. Regente", xs[1] + 5, y + 33);
  doc.text("Coordenação", xs[2] + 5, y + 33);

  const filename = `PAEE-PEI_${(d.identificacao?.discente || "estudante").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}

// ==========================================================
// Exportação DOCX
// ==========================================================
async function exportDOCX() {
  if (!lastGeneratedDoc) { alert("Nenhum documento para exportar."); return; }
  const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } = window.docx;
  const d = readDocFromDOM();

  function heading(text) {
    return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120 }, children: [new TextRun({ text, bold: true, color: "2D5016", size: 26 })] });
  }
  function subnote(text) {
    return new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text, italics: true, color: "888888", size: 16 })] });
  }
  function fieldP(label, value) {
    if (!value) return [];
    return [
      new Paragraph({ spacing: { before: 100, after: 40 }, children: [new TextRun({ text: label.toUpperCase(), bold: true, color: "4A5341", size: 18 })] }),
      new Paragraph({ spacing: { after: 100 }, children: [new TextRun({ text: value, size: 22 })] })
    ];
  }

  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Instrumento Pedagógico Integrado · PAEE + PEI", bold: true, size: 32, color: "2D5016" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [new TextRun({ text: "Portaria MEC nº 421/2026 · Art. 7 §2 · Parecer CNE/CP 50/2023", italics: true, size: 18, color: "6F7A66" })] })
  ];

  children.push(heading("Identificação"));
  [["Discente", d.identificacao?.discente], ["Escola", d.identificacao?.escola], ["Disciplina", d.identificacao?.disciplina],
   ["Ano / Turma", d.identificacao?.ano_turma], ["Quantidade de aulas", d.identificacao?.quantidade_aulas],
   ["Tipo de deficiência / condição", d.identificacao?.tipo_deficiencia], ["Prof. Regente", d.identificacao?.prof_regente],
   ["Prof. do AEE", d.identificacao?.prof_aee]].forEach(([l, v]) => children.push(...fieldP(l, v)));

  children.push(heading("PAEE · Plano de Atendimento Educacional Especializado"));
  children.push(subnote("Preenchido pelo professor do AEE (Art. 10, Portaria 421/2026). Não preenchido pela IA."));
  [["Barreiras identificadas", d.paee?.barreiras_identificadas], ["Materiais e recursos", d.paee?.materiais_recursos],
   ["Tecnologia assistiva e CAA", d.paee?.tecnologia_assistiva], ["Profissional de apoio escolar", d.paee?.profissional_apoio],
   ["Demandas de formação e rede de proteção", d.paee?.rede_protecao]].forEach(([l, v]) => children.push(...fieldP(l, v || "_______________________________________________")));

  children.push(heading("PEI · Plano Educacional Individualizado"));
  children.push(subnote("Sugerido pela IA · Art. 11, Portaria 421/2026 · revisar antes de oficializar."));
  children.push(...fieldP("Acessibilidade de conteúdo", d.pei?.acessibilidade_conteudo));
  children.push(...fieldP("Objetivos específicos", d.pei?.objetivos_especificos));
  children.push(...fieldP("Metodologia e recursos", d.pei?.metodologia_recursos));
  children.push(...fieldP("Medidas de acessibilidade avaliativa", d.pei?.medidas_acessibilidade_avaliativa));
  children.push(...fieldP("Indicadores de progresso", d.pei?.indicadores_progresso));
  children.push(...fieldP("Estratégia de acompanhamento", d.pei?.estrategia_acompanhamento));
  children.push(...fieldP("Parecer avaliativo · antes", d.pei?.parecer_avaliativo?.antes));
  children.push(...fieldP("Parecer avaliativo · após", d.pei?.parecer_avaliativo?.depois || "A preencher após a execução do bloco de aulas."));
  children.push(...fieldP("Devolutiva à família", d.pei?.devolutiva_familia));

  if (d.observacoes_pedagogicas) { children.push(heading("Observações pedagógicas")); children.push(...fieldP("", d.observacoes_pedagogicas)); }
  if (d.fundamentacao?.length) {
    children.push(heading("Fundamentação"));
    d.fundamentacao.forEach(f => children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `· ${f}`, size: 20 })] })));
  }

  children.push(
    new Paragraph({ spacing: { before: 480 }, children: [new TextRun({ text: "_________________________     _________________________     _________________________", size: 18 })] }),
    new Paragraph({ children: [new TextRun({ text: "Prof. do AEE                          Prof. Regente                          Coordenação", size: 16 })] })
  );

  const docx = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(docx);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PAEE-PEI_${(d.identificacao?.discente || "estudante").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================
// Init
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  loadLocal();
  document.querySelectorAll("#form-plano input, #form-plano select, #form-plano textarea, #form-caso input, #form-caso select, #form-caso textarea").forEach(el => {
    el.addEventListener("change", saveLocal); el.addEventListener("blur", saveLocal);
  });
});
