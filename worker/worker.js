/**
 * Sistema PAEE + PEI · Cloudflare Worker
 *
 * Recebe { plano_ensino, estudo_caso } via POST /generate
 * Constrói prompt informado pela Portaria MEC 421/2026 (Art. 11 - PEI),
 * Decreto 12.686/2025 e Parecer CNE/CP 50/2023.
 * A IA preenche APENAS o PEI (responsabilidade do professor regente).
 * O PAEE (responsabilidade do professor do AEE) retorna estruturado em branco.
 *
 * Deploy: cole este arquivo no editor do Cloudflare Worker e Save & Deploy.
 * Secret necessário: GROQ_API_KEY (ou conforme PROVIDER).
 */

const PROVIDERS = {
  groq: {
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    model: "llama-3.3-70b-versatile",
    apiKeyEnv: "GROQ_API_KEY"
  },
  openrouter: {
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    apiKeyEnv: "OPENROUTER_API_KEY"
  },
  cerebras: {
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    model: "llama-3.3-70b",
    apiKeyEnv: "CEREBRAS_API_KEY"
  },
  gemini: {
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    special: "gemini"
  }
};

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsResponse();
    if (request.method !== "POST") return jsonResponse({ error: "Use POST." }, 405);

    try {
      const body = await request.json();
      if (!body.plano_ensino || !body.estudo_caso) {
        return jsonResponse({ error: "Faltam plano_ensino ou estudo_caso." }, 400);
      }

      const providerName = (env.PROVIDER || "groq").toLowerCase();
      const provider = PROVIDERS[providerName];
      if (!provider) return jsonResponse({ error: `Provedor desconhecido: ${providerName}` }, 500);

      const apiKey = env[provider.apiKeyEnv];
      if (!apiKey) return jsonResponse({ error: `API key ausente: ${provider.apiKeyEnv}` }, 500);

      const prompt = buildPrompt(body.plano_ensino, body.estudo_caso);

      const pei = provider.special === "gemini"
        ? await callGemini(provider, apiKey, prompt)
        : await callOpenAICompatible(provider, apiKey, prompt);

      const normalized = normalizeDoc(pei, body.plano_ensino, body.estudo_caso);
      return jsonResponse(normalized, 200);
    } catch (err) {
      console.error("Erro no Worker:", err);
      return jsonResponse({ error: err.message || "Erro interno" }, 500);
    }
  }
};

// ==========================================================
// Construção do prompt - PEI conforme Art. 11 Portaria 421/2026
// ==========================================================
function buildPrompt(planoEnsino, estudoCaso) {
  const systemPrompt = `Você é uma professora especialista em Educação Especial e Atendimento Educacional Especializado (AEE), com mestrado na área e domínio da Portaria MEC nº 421/2026 (que regulamenta o Decreto nº 12.686/2025 e institui a Política Nacional de Educação Especial Inclusiva), do Parecer CNE/CP nº 50/2023 e da BNCC.

Sua tarefa: elaborar APENAS o PEI (Plano Educacional Individualizado) com base em duas entradas – o plano de ensino do professor regente e o estudo de caso do estudante.

CONTEXTO LEGAL CRÍTICO (Portaria 421/2026):
- O PEI é o documento que contempla o plano de acessibilização curricular e é de responsabilidade do PROFESSOR REGENTE (Art. 11).
- O PAEE (Plano de Atendimento Educacional Especializado) é responsabilidade do PROFESSOR DO AEE (Art. 10) e NÃO deve ser preenchido por você. O PAEE trata de eliminação de barreiras, tecnologia assistiva, profissional de apoio escolar e acionamento da rede de proteção social – decisões que cabem exclusivamente ao professor do AEE e à gestão escolar.
- VOCÊ NÃO DEVE sugerir acionamento de Conselho Tutelar, indicação de profissional de apoio, articulação com SUS, ou qualquer decisão da alçada do PAEE. Limite-se ao plano de acessibilização curricular (PEI).
- A matrícula e o AEE NÃO podem ser condicionados a diagnóstico ou laudo (Art. 7 §4). Nunca exija laudo.

O PEI deve conter, conforme Art. 11 da Portaria 421/2026:
- medidas de acessibilidade curricular, didático-pedagógica e avaliativa;
- estratégias de acompanhamento e monitoramento do plano;
- registro das devolutivas às famílias.

DIRETRIZES OBRIGATÓRIAS:

1. ESTRUTURA. Preencha com profundidade cada campo do PEI no schema. Os campos do PAEE retornam sempre como null (não é sua função preenchê-los).

2. LINGUAGEM. Linguagem pedagógica precisa, respeitosa, centrada no estudante. NUNCA use expressões capacitistas ("portador de", "sofre de", "vítima de", "preso a", "limitado por"). Prefira "estudante com TEA", "estudante com deficiência intelectual", "estudante surdo". Pessoa primeiro.

3. EXEQUIBILIDADE. Sugestões concretas e implementáveis pelo professor regente em sala comum, considerando os recursos do plano de ensino. Privilegie materiais analógicos e de baixo custo.

4. INDIVIDUALIZAÇÃO REAL. Use detalhes específicos do estudo de caso (interesses, habilidades, estilo de aprendizagem, particularidades sensoriais, nível pedagógico). Um PEI genérico falha em seu propósito.

5. LIMITES. NÃO faça diagnósticos médicos, NÃO prescreva terapias, NÃO invente informações ausentes. Se faltar informação crítica, sinalize em observacoes_pedagogicas o que coletar – mas produza o PEI com o disponível.

6. ACESSIBILIDADE AVALIATIVA. Em medidas_acessibilidade_avaliativa, descreva COMO o estudante será avaliado com adaptações (tempo estendido, prova oral, ledor, instrumentos alternativos), coerente com o perfil.

7. MONITORAMENTO. Em indicadores_progresso, liste indicadores observáveis e concretos. Em estrategia_acompanhamento, descreva como o progresso será acompanhado ao longo do bloco.

8. DEVOLUTIVA À FAMÍLIA. Em devolutiva_familia, sugira uma forma e conteúdo de devolutiva à família sobre o progresso (a data fica em branco, será preenchida pela escola).

9. FUNDAMENTAÇÃO. Em fundamentacao, cite a Portaria MEC 421/2026, o Parecer CNE/CP 50/2023 e, quando aplicável, códigos BNCC e referências pertinentes.

10. SAÍDA. Produza exclusivamente JSON válido no schema abaixo, sem texto antes ou depois.

SCHEMA DE SAÍDA:
{
  "identificacao": {
    "discente": "<nome>",
    "escola": "<escola ou null>",
    "disciplina": "<disciplina>",
    "quantidade_aulas": "<ex: bloco de 3 aulas>",
    "data_inicio": null,
    "data_conclusao": null,
    "tipo_deficiencia": "<condição informada, ou 'Não informado' se ausente>",
    "prof_aee": "<docente AEE ou null>",
    "prof_regente": "<docente regente ou null>",
    "ano_turma": "<ano/turma ou null>"
  },
  "paee": {
    "_nota": "Seção de responsabilidade do professor do AEE (Art. 10, Portaria 421/2026). Não preenchida pela IA.",
    "barreiras_identificadas": null,
    "materiais_recursos": null,
    "espacos_aee": null,
    "tecnologia_assistiva": null,
    "comunicacao_aumentativa": null,
    "profissional_apoio": null,
    "demandas_formacao": null,
    "rede_protecao": null
  },
  "pei": {
    "acessibilidade_conteudo": "<texto: descrição do conteúdo e adaptações previstas>",
    "objetivos_especificos": "<texto: objetivos mensuráveis derivados do plano>",
    "metodologia_recursos": "<texto: estratégias concretas e materiais nomeados>",
    "medidas_acessibilidade_avaliativa": "<texto: como o estudante será avaliado com adaptações>",
    "indicadores_progresso": "<texto: indicadores observáveis de progresso>",
    "estrategia_acompanhamento": "<texto: como o progresso será monitorado>",
    "parecer_avaliativo": {
      "antes": "<texto: estágio inicial do estudante frente ao conteúdo>",
      "depois": null
    },
    "devolutiva_familia": "<texto: forma e conteúdo sugeridos para devolutiva à família>"
  },
  "fundamentacao": [
    "Portaria MEC nº 421/2026",
    "Parecer CNE/CP nº 50/2023",
    "<outras referências>"
  ],
  "observacoes_pedagogicas": "<observações ou null>"
}

EXEMPLO (estudante 5º ano com TEA, Língua Portuguesa, parlendas/trava-línguas/quadrinhas):
{
  "identificacao": {
    "discente": "[Nome]", "escola": "[Escola]", "disciplina": "Língua Portuguesa",
    "quantidade_aulas": "bloco de 3 aulas", "data_inicio": null, "data_conclusao": null,
    "tipo_deficiencia": "Transtorno do Espectro Autista (TEA)",
    "prof_aee": "[Prof. AEE]", "prof_regente": "[Prof. Regente]", "ano_turma": "5º ano"
  },
  "paee": {
    "_nota": "Seção de responsabilidade do professor do AEE (Art. 10, Portaria 421/2026). Não preenchida pela IA.",
    "barreiras_identificadas": null, "materiais_recursos": null, "espacos_aee": null,
    "tecnologia_assistiva": null, "comunicacao_aumentativa": null, "profissional_apoio": null,
    "demandas_formacao": null, "rede_protecao": null
  },
  "pei": {
    "acessibilidade_conteudo": "Acessibilização do conteúdo de gêneros textuais (parlendas, trava-línguas e quadrinhas). O estudante atua como copista de frases e apresenta dificuldades na leitura fluente e na escrita espontânea. A meta de acessibilização é desenvolver a fluência leitora e a construção autônoma de pequenas frases, usando a estrutura rítmica e repetitiva dos gêneros como suporte.",
    "objetivos_especificos": "Desenvolver a fluência leitora e a escrita autônoma por meio de parlendas, trava-línguas e quadrinhas, com reconhecimento de padrões rítmicos e sonoros (BNCC EF05LP09).",
    "metodologia_recursos": "Cartões com versos incompletos para o estudante completar, favorecendo reconhecimento visual e auditivo dos padrões. Suporte multimodal (verso impresso em fonte ampliada com áudio) e versos recortados para reconstrução textual. Atividades em blocos curtos de 10 a 15 minutos com pausas previsíveis, respeitando a sensibilidade auditiva. Hiperfoco em temas de interesse usado como ponte motivacional.",
    "medidas_acessibilidade_avaliativa": "Avaliação processual por observação, com registro da participação e da reconstrução dos versos. Permitir resposta oral quando a escrita for barreira. Considerar a produção apoiada por cartões como evidência de aprendizagem, não apenas a escrita espontânea.",
    "indicadores_progresso": "Completa versos com palavras adequadas ao padrão rítmico; reconhece rimas em pares de palavras; organiza ao menos 3 versos recortados na sequência correta; amplia gradualmente o tempo de tarefa.",
    "estrategia_acompanhamento": "Registro ao final de cada uma das três aulas, com anotação do que o estudante completou de forma autônoma e do que exigiu apoio. Comparação entre a primeira e a última aula do bloco.",
    "parecer_avaliativo": {
      "antes": "O estudante limitava-se à cópia de frases, sem demonstrar compreensão. Tinha dificuldade em identificar rimas e repetições apenas pela escuta. Reconhece padrões visuais com mais facilidade do que auditivos.",
      "depois": null
    },
    "devolutiva_familia": "Devolutiva presencial ou por agenda escolar, informando os avanços na leitura de versos e o uso dos cartões em casa como continuidade lúdica, com exemplos concretos do que o estudante já realiza."
  },
  "fundamentacao": [
    "Portaria MEC nº 421/2026 (Art. 11)",
    "Parecer CNE/CP nº 50/2023",
    "BNCC: EF05LP09",
    "Declaração de Salamanca (UNESCO, 1994)"
  ],
  "observacoes_pedagogicas": "Recomenda-se ambiente com baixo estímulo sonoro durante a leitura coletiva, considerando a hipersensibilidade auditiva do estudante."
}

Agora, com base nas entradas a seguir, elabore o PEI seguindo todas as diretrizes e o schema.`;

  const userPrompt = `ENTRADAS:

[PLANO DE ENSINO]
${JSON.stringify(planoEnsino, null, 2)}

[ESTUDO DE CASO]
${JSON.stringify(estudoCaso, null, 2)}

Produza agora o documento em JSON, seguindo rigorosamente o schema. Preencha apenas o PEI; mantenha o PAEE com null. Apenas JSON, sem texto adicional.`;

  return { systemPrompt, userPrompt };
}

// ==========================================================
// Chamadas LLM
// ==========================================================
async function callOpenAICompatible(provider, apiKey, prompt) {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 3500
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`LLM API error (${response.status}): ${errText.slice(0, 500)}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Resposta vazia da LLM.");
  return safeJSONParse(content);
}

async function callGemini(provider, apiKey, prompt) {
  const url = `${provider.endpoint}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: prompt.userPrompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 3500, responseMimeType: "application/json" }
    })
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errText.slice(0, 500)}`);
  }
  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Resposta vazia da Gemini.");
  return safeJSONParse(content);
}

// ==========================================================
// Helpers
// ==========================================================
function safeJSONParse(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_) {}
    }
    throw new Error("Falha ao fazer parse do JSON da LLM: " + cleaned.slice(0, 300));
  }
}

function normalizeDoc(doc, planoEnsino, estudoCaso) {
  doc.identificacao ||= {};
  const id = doc.identificacao;
  id.discente ||= estudoCaso.nome || "";
  id.escola ||= estudoCaso.escola || "";
  id.disciplina ||= planoEnsino.disciplina || "";
  id.quantidade_aulas ||= planoEnsino.quantidade_aulas || "";
  id.tipo_deficiencia ||= estudoCaso.tipo_deficiencia || "Não informado";
  id.prof_aee ||= planoEnsino.prof_aee || estudoCaso.prof_aee || "";
  id.prof_regente ||= planoEnsino.docente || estudoCaso.prof_regente || "";
  id.ano_turma ||= planoEnsino.ano || estudoCaso.ano_turma || "";
  id.data_inicio ||= null;
  id.data_conclusao ||= null;

  // PAEE sempre em branco (responsabilidade do AEE)
  doc.paee = {
    _nota: "Seção de responsabilidade do professor do AEE (Art. 10, Portaria 421/2026). Não preenchida pela IA.",
    barreiras_identificadas: null,
    materiais_recursos: null,
    espacos_aee: null,
    tecnologia_assistiva: null,
    comunicacao_aumentativa: null,
    profissional_apoio: null,
    demandas_formacao: null,
    rede_protecao: null
  };

  doc.pei ||= {};
  const pei = doc.pei;
  pei.acessibilidade_conteudo ||= "";
  pei.objetivos_especificos ||= "";
  pei.metodologia_recursos ||= "";
  pei.medidas_acessibilidade_avaliativa ||= "";
  pei.indicadores_progresso ||= "";
  pei.estrategia_acompanhamento ||= "";
  pei.parecer_avaliativo ||= {};
  pei.parecer_avaliativo.antes ||= "";
  pei.parecer_avaliativo.depois = null;
  pei.devolutiva_familia ||= "";

  doc.fundamentacao = Array.isArray(doc.fundamentacao) ? doc.fundamentacao : [];
  if (!doc.fundamentacao.some(r => r.includes("421/2026"))) {
    doc.fundamentacao.unshift("Portaria MEC nº 421/2026");
  }
  if (!doc.fundamentacao.some(r => r.includes("50/2023"))) {
    doc.fundamentacao.push("Parecer CNE/CP nº 50/2023");
  }

  doc.observacoes_pedagogicas ||= null;
  return doc;
}

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400"
    }
  });
}
