/**
 * Sistema PEI · Cloudflare Worker
 *
 * Recebe { plano_ensino, estudo_caso } via POST /generate
 * Constrói prompt informado pelo Parecer CNE/CP 50/2023 + Guia PEI
 * Chama LLM (Groq, Gemini, OpenRouter — configurável via secrets)
 * Retorna PEI estruturado em JSON
 *
 * Deploy:
 *   npx wrangler deploy
 *
 * Secrets necessários:
 *   npx wrangler secret put GROQ_API_KEY
 *   (ou GEMINI_API_KEY, ou OPENROUTER_API_KEY conforme PROVIDER)
 */

// ==========================================================
// Configuração de provedores LLM (OpenAI-compatible)
// ==========================================================
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
    // Gemini tem API própria; tratamos como caso especial
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
    model: "gemini-2.0-flash",
    apiKeyEnv: "GEMINI_API_KEY",
    special: "gemini"
  }
};

// ==========================================================
// Handler principal
// ==========================================================
export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === "OPTIONS") return corsResponse();

    if (request.method !== "POST") {
      return jsonResponse({ error: "Use POST." }, 405);
    }

    try {
      const body = await request.json();
      if (!body.plano_ensino || !body.estudo_caso) {
        return jsonResponse({ error: "Faltam plano_ensino ou estudo_caso." }, 400);
      }

      // Seleção do provedor (default: groq)
      const providerName = (env.PROVIDER || "groq").toLowerCase();
      const provider = PROVIDERS[providerName];
      if (!provider) {
        return jsonResponse({ error: `Provedor desconhecido: ${providerName}` }, 500);
      }

      const apiKey = env[provider.apiKeyEnv];
      if (!apiKey) {
        return jsonResponse({ error: `API key ausente: ${provider.apiKeyEnv}` }, 500);
      }

      // Monta o prompt
      const prompt = buildPrompt(body.plano_ensino, body.estudo_caso);

      // Chama LLM
      const pei = provider.special === "gemini"
        ? await callGemini(provider, apiKey, prompt)
        : await callOpenAICompatible(provider, apiKey, prompt);

      // Pós-processamento e validação leve
      const normalized = normalizePEI(pei, body.plano_ensino, body.estudo_caso);

      return jsonResponse(normalized, 200);
    } catch (err) {
      console.error("Erro no Worker:", err);
      return jsonResponse({ error: err.message || "Erro interno" }, 500);
    }
  }
};

// ==========================================================
// Construção do prompt
// ==========================================================
function buildPrompt(planoEnsino, estudoCaso) {
  const systemPrompt = `Você é uma professora especialista em Educação Especial e Atendimento Educacional Especializado (AEE), com mestrado na área e domínio do Parecer CNE/CP nº 50/2023 do Conselho Nacional de Educação (homologado em 11/2024), da Base Nacional Comum Curricular (BNCC) e de práticas validadas de educação inclusiva.

Sua tarefa: elaborar um Plano Educacional Individualizado (PEI) com base em duas entradas — o plano de ensino da professora regente e o estudo de caso preenchido pela equipe pedagógica/AEE sobre o estudante.

DIRETRIZES OBRIGATÓRIAS:

1. NATUREZA DO PEI. O PEI é um documento de natureza pedagógica que orienta o trabalho do docente na sala de aula comum. A acessibilidade de conteúdo descrita no PEI será ministrada pelo docente da unidade curricular. A professora do AEE apoia a construção de materiais e estratégias.

2. DISTINÇÃO ENTRE DOCUMENTOS. O PEI difere do PDI (Plano de Desenvolvimento Individual — documento investigativo global) e do PAEE (Plano de Atendimento Educacional Especializado — direciona o trabalho na sala de recursos). Foque exclusivamente em ACESSIBILIDADE DE CONTEÚDO na sala de aula comum.

3. ESTRUTURA OBRIGATÓRIA da saída (cada uma das 4 partes deve ser preenchida com profundidade):
   - acessibilidade_conteudo: descreva o que precisa ser tornado acessível e como, de forma específica ao conteúdo do plano de ensino e ao perfil do estudante. 3-5 frases.
   - objetivos_especificos: derivados do plano de ensino, recontextualizados para o estudante. Mensuráveis. 2-3 frases.
   - metodologia: estratégias concretas, materiais nomeados, atividades exequíveis pela professora regente. 4-6 frases. Inclua materiais físicos sugeridos (ex: cartões com versos incompletos, suporte multimodal, versos recortados para reconstrução textual).
   - parecer_avaliativo.antes: descreva o estágio inicial do estudante em relação ao conteúdo proposto, considerando o estudo de caso. 3-4 frases. Deixe parecer_avaliativo.depois como null (será preenchido pela docente após execução).

4. LINGUAGEM. Use linguagem pedagógica precisa, respeitosa e centrada no estudante. NUNCA use expressões capacitistas ("portador de", "sofre de", "vítima de", "preso a", "limitado por"). Prefira: "estudante com TEA", "estudante com deficiência intelectual", "estudante surdo", etc. Pessoa primeiro.

5. EXEQUIBILIDADE. Suas sugestões devem ser concretas e implementáveis por uma professora em sala comum, considerando os recursos do plano de ensino. Não sugira tecnologias caras ou inacessíveis. Privilegie materiais analógicos quando possível.

6. INDIVIDUALIZAÇÃO REAL. Use detalhes específicos do estudo de caso (interesses, habilidades, nível de escrita, particularidades sensoriais) na proposta. Um PEI genérico falha em seu propósito.

7. LIMITES DO PEI. NÃO faça diagnósticos médicos, NÃO prescreva intervenções terapêuticas, NÃO substitua avaliação multidisciplinar. Atue apenas na dimensão pedagógica.

8. LACUNAS. Se faltar informação crítica nas entradas, sinalize em observacoes_pedagogicas o que seria importante coletar adicionalmente — mas ainda assim produza o PEI com o que está disponível.

9. FUNDAMENTAÇÃO. Em fundamentacao, cite o Parecer CNE/CP 50/2023 e, quando aplicável, códigos da BNCC e referências pedagógicas pertinentes ao tipo de deficiência.

10. SAÍDA. Produza exclusivamente JSON válido no schema abaixo, sem nenhum texto antes ou depois.

SCHEMA DE SAÍDA:
{
  "identificacao": {
    "discente": "<nome do estudante>",
    "escola": "<escola ou null>",
    "disciplina": "<disciplina do plano de ensino>",
    "quantidade_aulas": "<ex: 'bloco de 3 aulas'>",
    "data_inicio": null,
    "data_conclusao": null,
    "tipo_deficiencia": "<tipo informado no estudo de caso>",
    "docente": "<docente ou null>"
  },
  "adaptacoes_curriculares": {
    "acessibilidade_conteudo": "<texto>",
    "objetivos_especificos": "<texto>",
    "metodologia": "<texto>",
    "parecer_avaliativo": {
      "antes": "<texto>",
      "depois": null
    }
  },
  "fundamentacao": [
    "Parecer CNE/CP nº 50/2023",
    "<outras referências relevantes>"
  ],
  "observacoes_pedagogicas": "<observações ou null>"
}

EXEMPLO DE PEI BEM ELABORADO (estudante do 5º ano com TEA, Língua Portuguesa, bloco de 3 aulas, conteúdo: gêneros textuais — parlendas, trava-línguas, quadrinhas):

{
  "identificacao": {
    "discente": "[Nome do estudante]",
    "escola": "[Escola]",
    "disciplina": "Língua Portuguesa",
    "quantidade_aulas": "bloco de 3 aulas",
    "data_inicio": null,
    "data_conclusao": null,
    "tipo_deficiencia": "Transtorno do Espectro Autista (TEA)",
    "docente": "[Docente]"
  },
  "adaptacoes_curriculares": {
    "acessibilidade_conteudo": "Acessibilidade do conteúdo de gêneros textuais. O estudante apresenta dificuldades na leitura fluente e na escrita espontânea, atuando como copista de frases. A meta de aprendizagem é desenvolver a fluência leitora e a construção autônoma de pequenas frases, utilizando como suporte os gêneros parlenda, trava-língua e quadrinha. Este PEI foi desenvolvido de forma interdisciplinar, em diálogo com a professora do AEE, e será utilizado pela professora regente nas aulas de Língua Portuguesa em um bloco de três aulas.",
    "objetivos_especificos": "Desenvolver a fluência leitora e a escrita autônoma por meio da exploração de parlendas, trava-línguas e quadrinhas, utilizando recursos acessíveis que favoreçam a participação ativa do estudante e o reconhecimento de padrões rítmicos e sonoros.",
    "metodologia": "Foram construídos cartões com versos incompletos para que o estudante complete as palavras, promovendo o reconhecimento visual e auditivo dos padrões das parlendas, trava-línguas e quadrinhas. Além disso, foi implementado suporte multimodal e utilizados versos recortados para reconstrução textual, permitindo a organização sequencial e lógica do texto. O estudante participou da construção dos materiais nos atendimentos com a professora do AEE, o que facilitou sua compreensão e engajamento no momento da aula. As atividades foram organizadas em pequenos blocos com pausas previsíveis, respeitando a sensibilidade auditiva do estudante. O hiperfoco em temas de interesse foi aproveitado como ponte motivacional, integrando elementos preferidos do estudante aos versos trabalhados.",
    "parecer_avaliativo": {
      "antes": "O estudante apresentava dificuldades significativas na fluência leitora e na escrita espontânea, limitando-se à cópia de frases sem demonstrar compreensão do conteúdo. Tinha dificuldades em identificar padrões sonoros, como rimas e repetições, comuns no gênero textual parlenda. Reconhece padrões visuais com mais facilidade do que padrões apresentados apenas pela escuta.",
      "depois": null
    }
  },
  "fundamentacao": [
    "Parecer CNE/CP nº 50/2023",
    "BNCC: EF05LP09 (compreender padrões textuais em gêneros líricos populares)",
    "Princípios da Declaração de Salamanca (UNESCO, 1994)"
  ],
  "observacoes_pedagogicas": "Recomenda-se ambiente com baixo estímulo sonoro durante a leitura coletiva, considerando a hipersensibilidade auditiva do estudante."
}

Agora, com base nas entradas a seguir, elabore o PEI seguindo todas as diretrizes e o schema.`;

  const userPrompt = `ENTRADAS:

[PLANO DE ENSINO]
${JSON.stringify(planoEnsino, null, 2)}

[ESTUDO DE CASO]
${JSON.stringify(estudoCaso, null, 2)}

Produza agora o PEI em JSON, seguindo rigorosamente o schema. Apenas JSON, sem texto adicional.`;

  return { systemPrompt, userPrompt };
}

// ==========================================================
// Chamada a APIs OpenAI-compatible (Groq, OpenRouter, Cerebras)
// ==========================================================
async function callOpenAICompatible(provider, apiKey, prompt) {
  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: prompt.systemPrompt },
        { role: "user", content: prompt.userPrompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 2500
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

// ==========================================================
// Chamada Gemini (API não-OpenAI)
// ==========================================================
async function callGemini(provider, apiKey, prompt) {
  const url = `${provider.endpoint}?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: prompt.systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: prompt.userPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 2500,
        responseMimeType: "application/json"
      }
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
  // Remove blocos markdown caso o modelo retorne ```json ... ```
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*$/gi, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    // Tenta extrair primeiro objeto JSON da string
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (_) {}
    }
    throw new Error("Falha ao fazer parse do JSON retornado pela LLM. Conteúdo: " + cleaned.slice(0, 300));
  }
}

function normalizePEI(pei, planoEnsino, estudoCaso) {
  // Garante presença de todos os campos do schema
  pei.identificacao ||= {};
  pei.identificacao.discente ||= estudoCaso.nome || "";
  pei.identificacao.escola ||= estudoCaso.escola || "";
  pei.identificacao.disciplina ||= planoEnsino.disciplina || "";
  pei.identificacao.quantidade_aulas ||= planoEnsino.quantidade_aulas || "";
  pei.identificacao.tipo_deficiencia ||= estudoCaso.tipo_deficiencia || "";
  pei.identificacao.docente ||= planoEnsino.docente || "";
  pei.identificacao.data_inicio ||= null;
  pei.identificacao.data_conclusao ||= null;

  pei.adaptacoes_curriculares ||= {};
  pei.adaptacoes_curriculares.acessibilidade_conteudo ||= "";
  pei.adaptacoes_curriculares.objetivos_especificos ||= "";
  pei.adaptacoes_curriculares.metodologia ||= "";
  pei.adaptacoes_curriculares.parecer_avaliativo ||= {};
  pei.adaptacoes_curriculares.parecer_avaliativo.antes ||= "";
  pei.adaptacoes_curriculares.parecer_avaliativo.depois = null;

  pei.fundamentacao = Array.isArray(pei.fundamentacao) ? pei.fundamentacao : [];
  if (!pei.fundamentacao.some(r => r.includes("50/2023"))) {
    pei.fundamentacao.unshift("Parecer CNE/CP nº 50/2023");
  }

  pei.observacoes_pedagogicas ||= null;

  return pei;
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
