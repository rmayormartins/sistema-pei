/* ==========================================================
   Sistema PEI · Lógica frontend
   ========================================================== */

// CONFIGURAÇÃO. Trocar pela URL do seu Cloudflare Worker em produção.
const WORKER_URL = "https://sistema-pei-worker.rmayormartins.workers.dev/generate";

// Estado global
let currentStep = 1;
let lastGeneratedPEI = null;
let lastInputs = null;

// ==========================================================
// Navegação entre etapas
// ==========================================================
function goToStep(n) {
  // Validação simples ao avançar
  if (n > currentStep) {
    if (currentStep === 1 && !validateForm("form-plano")) return;
    if (currentStep === 2 && !validateForm("form-caso")) return;
  }

  document.querySelectorAll(".step-panel").forEach(p => {
    p.classList.remove("active");
    p.hidden = true;
  });
  document.querySelectorAll(".step-tab").forEach(t => {
    t.classList.remove("active");
    const step = parseInt(t.dataset.step);
    if (step < n) t.classList.add("completed");
    else t.classList.remove("completed");
  });

  const panel = document.getElementById(`step-${n}`);
  panel.hidden = false;
  panel.classList.add("active");
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
    if (!el.value.trim()) {
      el.style.borderColor = "var(--color-error)";
      if (!firstInvalid) firstInvalid = el;
    } else {
      el.style.borderColor = "";
    }
  });
  if (firstInvalid) {
    firstInvalid.focus();
    alert("Preencha os campos obrigatórios (marcados com *).");
    return false;
  }
  return true;
}

// ==========================================================
// Coleta de dados dos formulários
// ==========================================================
function collectFormData(formId) {
  const form = document.getElementById(formId);
  const data = {};
  form.querySelectorAll("input, select, textarea").forEach(el => {
    if (el.name) data[el.name] = el.value.trim();
  });
  return data;
}

// ==========================================================
// Persistência local
// ==========================================================
function saveLocal() {
  const state = {
    plano: collectFormData("form-plano"),
    caso: collectFormData("form-caso"),
    pei: lastGeneratedPEI,
    step: currentStep,
    ts: Date.now()
  };
  try {
    localStorage.setItem("sistema-pei-state", JSON.stringify(state));
  } catch (e) {
    console.warn("Não foi possível salvar localmente:", e);
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem("sistema-pei-state");
    if (!raw) return;
    const state = JSON.parse(raw);
    // Sessões com mais de 7 dias: descarta
    if (Date.now() - state.ts > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem("sistema-pei-state");
      return;
    }
    Object.entries(state.plano || {}).forEach(([k, v]) => {
      const el = document.querySelector(`#form-plano [name="${k}"]`);
      if (el) el.value = v;
    });
    Object.entries(state.caso || {}).forEach(([k, v]) => {
      const el = document.querySelector(`#form-caso [name="${k}"]`);
      if (el) el.value = v;
    });
    if (state.pei) {
      lastGeneratedPEI = state.pei;
      renderPEI(state.pei);
    }
  } catch (e) {
    console.warn("Erro ao carregar estado local:", e);
  }
}

// ==========================================================
// Exemplo: TEA, 5º ano, Língua Portuguesa
// (baseado no Guia PEI - Canaã dos Carajás)
// ==========================================================
function loadExample() {
  const example = {
    plano: {
      disciplina: "Língua Portuguesa",
      ano: "5º ano",
      turma: "5A",
      quantidade_aulas: "bloco de 3 aulas",
      docente: "Profa. exemplo",
      conteudo: "Gêneros textuais — parlendas, trava-línguas e quadrinhas. Estrutura rítmica, rimas, repetições, leitura fluente e produção textual.",
      objetivos: "Desenvolver fluência leitora; reconhecer padrões rítmicos e sonoros (rimas, repetições); produzir pequenos textos no gênero parlenda. Referência BNCC: EF05LP09.",
      metodologia: "Leitura coletiva em voz alta, atividades em duplas, produção textual escrita, dramatização de parlendas.",
      avaliacao: "Observação contínua, leitura oral, produção textual escrita.",
      recursos: "Livro didático, lousa, cartões impressos, sala de recursos multifuncional disponível para apoio."
    },
    caso: {
      nome: "Estudante exemplo",
      data_nascimento: "2014-03-15",
      sexo: "masculino",
      escola: "EMEF Exemplo",
      tipo_deficiencia: "TEA",
      diagnostico_detalhe: "TEA nível 1 de suporte. Laudo emitido por neuropediatra em 2022. Frequenta acompanhamento com fonoaudióloga e psicopedagoga semanalmente.",
      desenvolvimento_motor: "Marcos motores dentro do esperado. Coordenação motora fina ainda em desenvolvimento, escrita com letra grande e pouco firme.",
      desenvolvimento_linguagem: "Linguagem oral funcional, vocabulário restrito a temas de interesse. Dificuldade com linguagem figurada e duplo sentido.",
      desenvolvimento_social: "Interage com pares específicos. Tem rotinas estabelecidas, pode reagir com ansiedade a mudanças inesperadas. Demonstra empatia em situações concretas.",
      sintomas: "Hiperfoco em temas de interesse (dinossauros, trens). Sensibilidade auditiva — pede para sair em momentos de barulho intenso. Prefere atividades estruturadas.",
      equipe_multidisciplinar: "Fonoaudióloga (semanal), psicopedagoga (semanal), professora do AEE (3x semana).",
      nivel_escrita: "Silábico alfabético",
      ano_compativel: "compatível com 3º ano em produção textual; 5º ano em compreensão oral",
      habilidades_interesses: "Memória visual e auditiva fortes. Gosta de música, ritmos repetitivos e atividades com cartões. Reconhece padrões com facilidade quando apresentados visualmente.",
      dificuldades: "Fluência leitora limitada — copia frases mais do que produz autonomamente. Dificuldade em identificar rimas e padrões sonoros apenas pela escuta. Cansaço em tarefas longas de escrita.",
      sondagem_inicial: "Estudante na fase silábico alfabética, atualmente como copista de frases. Reconhece padrões visuais com mais facilidade do que auditivos."
    }
  };

  Object.entries(example.plano).forEach(([k, v]) => {
    const el = document.querySelector(`#form-plano [name="${k}"]`);
    if (el) el.value = v;
  });
  Object.entries(example.caso).forEach(([k, v]) => {
    const el = document.querySelector(`#form-caso [name="${k}"]`);
    if (el) el.value = v;
  });

  alert("Exemplo carregado: estudante do 5º ano com TEA, Língua Portuguesa.");
}

// ==========================================================
// Geração do PEI (chamada ao Worker)
// ==========================================================
async function generatePEI() {
  if (!validateForm("form-caso")) return;

  goToStep(3);

  const plano = collectFormData("form-plano");
  const caso = collectFormData("form-caso");
  lastInputs = { plano_ensino: plano, estudo_caso: caso };

  // UI: loading
  document.getElementById("generation-loading").hidden = false;
  document.getElementById("generation-error").hidden = true;
  document.getElementById("pei-result").hidden = true;
  document.getElementById("result-actions").hidden = true;

  try {
    const response = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lastInputs)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Erro ${response.status}: ${errText}`);
    }

    const pei = await response.json();
    lastGeneratedPEI = pei;
    renderPEI(pei);
    saveLocal();
  } catch (err) {
    console.error(err);
    document.getElementById("generation-loading").hidden = true;
    document.getElementById("generation-error").hidden = false;
    document.getElementById("error-message").textContent =
      err.message + ". Verifique sua conexão e a configuração do Worker.";
  }
}

function regeneratePEI() {
  generatePEI();
}

// ==========================================================
// Renderização do PEI
// ==========================================================
function renderPEI(pei) {
  document.getElementById("generation-loading").hidden = true;
  document.getElementById("generation-error").hidden = true;
  document.getElementById("pei-result").hidden = false;
  document.getElementById("result-actions").hidden = false;

  // Preenche todos os campos contenteditable via data-field
  document.querySelectorAll(".pei-input[data-field]").forEach(el => {
    const path = el.dataset.field.split(".");
    let value = pei;
    for (const key of path) {
      value = value?.[key];
      if (value === undefined || value === null) break;
    }
    el.textContent = value || "";
  });

  // Fundamentação (lista)
  const fundamentacao = pei.fundamentacao || [];
  const ul = document.getElementById("pei-fundamentacao");
  ul.innerHTML = "";
  fundamentacao.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    ul.appendChild(li);
  });

  // Listeners para edição inline persistir no estado
  document.querySelectorAll(".pei-input[data-field]").forEach(el => {
    el.removeEventListener("blur", peiInputChangeHandler);
    el.addEventListener("blur", peiInputChangeHandler);
  });
}

function peiInputChangeHandler(e) {
  if (!lastGeneratedPEI) return;
  const path = e.target.dataset.field.split(".");
  const value = e.target.textContent.trim();
  let obj = lastGeneratedPEI;
  for (let i = 0; i < path.length - 1; i++) {
    if (!obj[path[i]]) obj[path[i]] = {};
    obj = obj[path[i]];
  }
  obj[path[path.length - 1]] = value;
  saveLocal();
}

// ==========================================================
// Exportação PDF (via jsPDF)
// ==========================================================
function exportPDF() {
  if (!lastGeneratedPEI) {
    alert("Nenhum PEI para exportar.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 50;
  const contentW = pageW - 2 * margin;
  let y = margin;

  const pei = readPEIFromDOM();

  // Header
  doc.setFillColor(45, 80, 22);
  doc.rect(0, 0, pageW, 80, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Plano Educacional Individualizado", margin, 40);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Em conformidade com o Parecer CNE/CP nº 50/2023", margin, 60);
  y = 110;

  doc.setTextColor(26, 31, 24);

  function ensureSpace(h) {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  function sectionTitle(t) {
    ensureSpace(40);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(45, 80, 22);
    doc.text(t, margin, y);
    doc.setDrawColor(82, 123, 62);
    doc.setLineWidth(1);
    doc.line(margin, y + 4, margin + contentW, y + 4);
    y += 22;
    doc.setTextColor(26, 31, 24);
  }

  function fieldBlock(label, value) {
    if (!value) return;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(74, 83, 65);
    doc.text(label.toUpperCase(), margin, y);
    y += 14;
    doc.setFontSize(10.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(26, 31, 24);
    const lines = doc.splitTextToSize(value, contentW);
    ensureSpace(lines.length * 13 + 10);
    doc.text(lines, margin, y);
    y += lines.length * 13 + 10;
  }

  // Identificação (grid)
  sectionTitle("Identificação");
  const idFields = [
    ["Discente", pei.identificacao?.discente],
    ["Escola", pei.identificacao?.escola],
    ["Disciplina", pei.identificacao?.disciplina],
    ["Quantidade de aulas", pei.identificacao?.quantidade_aulas],
    ["Data de início", pei.identificacao?.data_inicio],
    ["Concluído em", pei.identificacao?.data_conclusao],
    ["Tipo de deficiência", pei.identificacao?.tipo_deficiencia],
    ["Docente", pei.identificacao?.docente]
  ];
  idFields.forEach(([l, v]) => fieldBlock(l, v));

  // Adaptações curriculares
  sectionTitle("Adaptações curriculares");
  fieldBlock("Acessibilidade de conteúdo", pei.adaptacoes_curriculares?.acessibilidade_conteudo);
  fieldBlock("Objetivos específicos", pei.adaptacoes_curriculares?.objetivos_especificos);
  fieldBlock("Metodologia", pei.adaptacoes_curriculares?.metodologia);

  // Parecer
  sectionTitle("Parecer avaliativo");
  fieldBlock("Antes das atividades", pei.adaptacoes_curriculares?.parecer_avaliativo?.antes);
  fieldBlock("Depois das atividades", pei.adaptacoes_curriculares?.parecer_avaliativo?.depois || "A ser preenchido após a execução do bloco de aulas.");

  // Observações
  if (pei.observacoes_pedagogicas) {
    sectionTitle("Observações pedagógicas");
    fieldBlock("", pei.observacoes_pedagogicas);
  }

  // Fundamentação
  if (pei.fundamentacao?.length) {
    sectionTitle("Fundamentação");
    pei.fundamentacao.forEach(f => fieldBlock("·", f));
  }

  // Disclaimer
  ensureSpace(40);
  doc.setFontSize(8);
  doc.setTextColor(111, 122, 102);
  doc.setFont("helvetica", "italic");
  const disclaimer = "Documento gerado com apoio de inteligência artificial. Revisado pela equipe pedagógica. Não substitui avaliação multidisciplinar.";
  doc.text(doc.splitTextToSize(disclaimer, contentW), margin, y);
  y += 30;

  // Assinaturas
  ensureSpace(50);
  doc.setDrawColor(74, 83, 65);
  doc.setLineWidth(0.5);
  const col1X = margin + 30;
  const col2X = pageW - margin - 180;
  doc.line(col1X, y + 20, col1X + 140, y + 20);
  doc.line(col2X, y + 20, col2X + 140, y + 20);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text("Coordenador(a) Pedagógico(a)", col1X + 5, y + 35);
  doc.text("Professor(a) da Unidade Curricular", col2X + 5, y + 35);

  const filename = `PEI_${(pei.identificacao?.discente || "estudante").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}

// ==========================================================
// Exportação DOCX (via docx.js)
// ==========================================================
async function exportDOCX() {
  if (!lastGeneratedPEI) {
    alert("Nenhum PEI para exportar.");
    return;
  }
  const { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer, BorderStyle } = window.docx;
  const pei = readPEIFromDOM();

  function heading(text) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 280, after: 120 },
      children: [new TextRun({ text, bold: true, color: "2D5016", size: 28 })]
    });
  }

  function fieldP(label, value) {
    if (!value) return [];
    return [
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: label.toUpperCase(), bold: true, color: "4A5341", size: 18 })]
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [new TextRun({ text: value, size: 22 })]
      })
    ];
  }

  const children = [];
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Plano Educacional Individualizado", bold: true, size: 36, color: "2D5016" })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: "Em conformidade com o Parecer CNE/CP nº 50/2023", italics: true, size: 18, color: "6F7A66" })]
    })
  );

  children.push(heading("Identificação"));
  [
    ["Discente", pei.identificacao?.discente],
    ["Escola", pei.identificacao?.escola],
    ["Disciplina", pei.identificacao?.disciplina],
    ["Quantidade de aulas", pei.identificacao?.quantidade_aulas],
    ["Data de início", pei.identificacao?.data_inicio],
    ["Concluído em", pei.identificacao?.data_conclusao],
    ["Tipo de deficiência", pei.identificacao?.tipo_deficiencia],
    ["Docente", pei.identificacao?.docente]
  ].forEach(([l, v]) => children.push(...fieldP(l, v)));

  children.push(heading("Adaptações curriculares"));
  children.push(...fieldP("Acessibilidade de conteúdo", pei.adaptacoes_curriculares?.acessibilidade_conteudo));
  children.push(...fieldP("Objetivos específicos", pei.adaptacoes_curriculares?.objetivos_especificos));
  children.push(...fieldP("Metodologia", pei.adaptacoes_curriculares?.metodologia));

  children.push(heading("Parecer avaliativo"));
  children.push(...fieldP("Antes das atividades", pei.adaptacoes_curriculares?.parecer_avaliativo?.antes));
  children.push(...fieldP("Depois das atividades", pei.adaptacoes_curriculares?.parecer_avaliativo?.depois || "A ser preenchido após a execução do bloco de aulas."));

  if (pei.observacoes_pedagogicas) {
    children.push(heading("Observações pedagógicas"));
    children.push(...fieldP("", pei.observacoes_pedagogicas));
  }

  if (pei.fundamentacao?.length) {
    children.push(heading("Fundamentação"));
    pei.fundamentacao.forEach(f => {
      children.push(new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: `· ${f}`, size: 20 })]
      }));
    });
  }

  children.push(
    new Paragraph({ spacing: { before: 480 }, children: [new TextRun({ text: "_________________________", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: "Coordenador(a) Pedagógico(a)", size: 18 })] }),
    new Paragraph({ spacing: { before: 240 }, children: [new TextRun({ text: "_________________________", size: 20 })] }),
    new Paragraph({ children: [new TextRun({ text: "Professor(a) da Unidade Curricular", size: 18 })] })
  );

  const doc = new Document({ sections: [{ properties: {}, children }] });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PEI_${(pei.identificacao?.discente || "estudante").replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================
// Lê PEI atual do DOM (incorpora edições do usuário)
// ==========================================================
function readPEIFromDOM() {
  const pei = JSON.parse(JSON.stringify(lastGeneratedPEI || {}));
  document.querySelectorAll(".pei-input[data-field]").forEach(el => {
    const path = el.dataset.field.split(".");
    let obj = pei;
    for (let i = 0; i < path.length - 1; i++) {
      if (!obj[path[i]]) obj[path[i]] = {};
      obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = el.textContent.trim();
  });
  return pei;
}

// ==========================================================
// Inicialização
// ==========================================================
document.addEventListener("DOMContentLoaded", () => {
  loadLocal();
  // Salva ao mudar qualquer campo do formulário
  document.querySelectorAll("#form-plano input, #form-plano select, #form-plano textarea, #form-caso input, #form-caso select, #form-caso textarea").forEach(el => {
    el.addEventListener("change", saveLocal);
    el.addEventListener("blur", saveLocal);
  });
});
