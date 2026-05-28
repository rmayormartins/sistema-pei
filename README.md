# Sistema PEI

> Geração assistida por IA de **Planos Educacionais Individualizados** com base no Parecer CNE/CP nº 50/2023.

Sistema web que combina o **plano de ensino** do docente regente com o **estudo de caso** do estudante para produzir um PEI estruturado conforme o guia oficial. O professor revisa, edita e exporta em PDF ou DOCX.

## Sumário

1. [Visão geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Deploy](#deploy)
4. [Configuração de provedores LLM](#configuração-de-provedores-llm)
5. [Como usar](#como-usar)
6. [Estratégia para Jovem Cientista](#estratégia-para-jovem-cientista)
7. [Trabalho futuro](#trabalho-futuro)

---

## Visão geral

O Parecer CNE/CP nº 50/2023 (homologado em 11/2024) institui o **Plano Educacional Individualizado (PEI)** como documento pedagógico que orienta o trabalho do docente regente na sala de aula comum, com apoio da professora do AEE. A elaboração manual do PEI consome tempo docente significativo. Este sistema oferece um primeiro rascunho automatizado, que a equipe pedagógica edita e valida.

**Não é** um substituto para a expertise docente nem para avaliação multidisciplinar. **É** uma ferramenta de apoio que devolve tempo para a mediação em sala.

### Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript ES2020 puro (sem build) |
| Hospedagem frontend | GitHub Pages |
| Backend | Cloudflare Workers (serverless edge) |
| LLM (default) | Groq · Llama 3.3 70B Versatile (free tier) |
| LLMs alternativas | OpenRouter, Cerebras, Google Gemini |
| Exportação | jsPDF, docx.js (client-side) |
| Persistência | localStorage (rascunho local) |

---

## Arquitetura

```
┌──────────────────┐   POST /generate   ┌────────────────────┐
│ Plano de ensino  │ ─────────────────► │                    │
│ (formulário)     │                    │ Cloudflare Worker  │
└──────────────────┘                    │                    │
                                        │ Constrói prompt    │
┌──────────────────┐                    │ informado pelo     │
│ Estudo de caso   │ ─────────────────► │ Parecer CNE 50/23  │
│ (formulário)     │                    │ + few-shot         │
└──────────────────┘                    │                    │
                                        └──────────┬─────────┘
                                                   │
                                                   ▼
                                        ┌────────────────────┐
                                        │       LLM          │
                                        │ (Groq / OpenRouter │
                                        │  / Cerebras / Gem) │
                                        └──────────┬─────────┘
                                                   │ JSON
                                                   ▼
                                        ┌────────────────────┐
                                        │ PEI estruturado    │
                                        │ → editor inline    │
                                        │ → PDF / DOCX       │
                                        └────────────────────┘
```

**Schema de saída do PEI:**

```json
{
  "identificacao": {
    "discente": "...", "escola": "...", "disciplina": "...",
    "quantidade_aulas": "...", "data_inicio": null, "data_conclusao": null,
    "tipo_deficiencia": "...", "docente": "..."
  },
  "adaptacoes_curriculares": {
    "acessibilidade_conteudo": "...",
    "objetivos_especificos": "...",
    "metodologia": "...",
    "parecer_avaliativo": { "antes": "...", "depois": null }
  },
  "fundamentacao": ["Parecer CNE/CP nº 50/2023", "..."],
  "observacoes_pedagogicas": "..."
}
```

---

## Deploy

### 1. Frontend (GitHub Pages)

```bash
git init
git add index.html styles.css app.js
git commit -m "Sistema PEI - frontend inicial"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/sistema-pei.git
git push -u origin main
```

No GitHub: **Settings → Pages → Source: main / root**. O site fica em `https://SEU-USUARIO.github.io/sistema-pei/`.

### 2. Backend (Cloudflare Worker)

Pré-requisitos: conta Cloudflare (gratuita) e Node.js instalado.

```bash
npm install -g wrangler
cd worker
wrangler login
wrangler secret put GROQ_API_KEY    # cole sua chave
wrangler deploy
```

A URL retornada (algo como `https://pei-worker.SEU-USUARIO.workers.dev`) deve ser colocada em `app.js`:

```js
const WORKER_URL = "https://pei-worker.SEU-USUARIO.workers.dev/generate";
```

Commit e push novamente.

---

## Configuração de provedores LLM

Todos os provedores têm **free tier** que cobrem testes e uso moderado em produção. Escolha um:

### Groq (recomendado · default)

- **Site:** https://console.groq.com
- **Modelo:** `llama-3.3-70b-versatile`
- **Free tier:** ~14.400 requisições/dia, ~6.000 tokens/min
- **Vantagem:** muito rápido (inferência em ms), excelente pt-BR
- **Configurar:** `wrangler secret put GROQ_API_KEY`

### OpenRouter

- **Site:** https://openrouter.ai
- **Modelo:** `meta-llama/llama-3.3-70b-instruct:free`
- **Free tier:** disponível com créditos iniciais
- **Vantagem:** acesso a múltiplos modelos pelo mesmo endpoint
- **Configurar:** edite `wrangler.toml` (`PROVIDER = "openrouter"`) e `wrangler secret put OPENROUTER_API_KEY`

### Cerebras

- **Site:** https://cloud.cerebras.ai
- **Modelo:** `llama-3.3-70b`
- **Free tier:** generoso para desenvolvedores
- **Vantagem:** inferência ultrarrápida
- **Configurar:** `PROVIDER = "cerebras"` e `wrangler secret put CEREBRAS_API_KEY`

### Google Gemini

- **Site:** https://aistudio.google.com
- **Modelo:** `gemini-2.0-flash`
- **Free tier:** 15 RPM, 1M tokens/dia
- **Vantagem:** modelo da Google, multilíngue
- **Configurar:** `PROVIDER = "gemini"` e `wrangler secret put GEMINI_API_KEY`

---

## Como usar

1. **Etapa 1 — Plano de ensino.** Preencha disciplina, ano, quantidade de aulas, conteúdo, objetivos (com código BNCC quando possível), metodologia e recursos.
2. **Etapa 2 — Estudo de caso.** Identifique o estudante, descreva o diagnóstico, desenvolvimento, nível de escrita, habilidades, interesses e dificuldades.
3. **Etapa 3 — PEI gerado.** Revise cada campo. Edite diretamente clicando no texto. Exporte em PDF ou DOCX.

Todos os dados ficam no navegador (localStorage). Nenhuma informação do estudante é armazenada em servidor.

---

## Estratégia para Jovem Cientista

Para o sistema ter mérito científico forte e não apenas tecnológico, sugiro estruturar a defesa em **três eixos de validação**.

### Eixo 1 · Validação da qualidade pedagógica

Construir uma **rubrica de avaliação do PEI** com dimensões:

| Dimensão | Descrição |
|---|---|
| Alinhamento curricular | O PEI dialoga com o plano de ensino? Respeita a BNCC? |
| Individualização | Usa informações específicas do estudo de caso ou é genérico? |
| Exequibilidade | A metodologia é implementável em sala comum com recursos típicos? |
| Conformidade legal | Respeita o Parecer CNE/CP 50/2023? |
| Linguagem | Evita capacitismo? Usa terminologia atual? |
| Coerência | As 4 seções dialogam entre si? |

**Desenho experimental sugerido:**

- N = 30 a 50 PEIs em três condições (A: humano, B: IA pura, C: IA + revisão docente)
- Avaliação cega por 3 professoras de AEE com mestrado na área
- Análise: Kruskal-Wallis ou ANOVA dependendo da distribuição, com testes post-hoc Dunn ou Tukey

### Eixo 2 · Estudo de uso com docentes reais

- **Métricas quantitativas:** tempo de elaboração (cronômetro), NASA-TLX (carga cognitiva), SUS (System Usability Scale)
- **Métricas qualitativas:** entrevista semiestruturada pós-uso
- **Amostra-piloto viável:** docentes do IFSC + redes municipais de Itajaí/São José/Florianópolis
- **Hipótese:** redução de 60%+ no tempo de elaboração inicial com manutenção ou ganho de qualidade após revisão docente

### Eixo 3 · Análise de viés e segurança

Pergunta crítica que diferencia o trabalho cientificamente: **a IA produz adaptações estereotipadas por tipo de deficiência?**

- Gerar PEIs para o mesmo plano de ensino variando apenas o tipo de deficiência
- Análise de conteúdo: as sugestões são realmente específicas ou recorrem a clichês?
- Verificar reprodução de vieses de gênero/raça nos exemplos
- Avaliar respeito a limites legais (não diagnostica, não prescreve terapia)

Esses três eixos juntos dão material para artigos em **WIE 2027**, **RBIE** e potencialmente uma **dissertação derivada**. Sinergia direta com o trabalho ProgCTQ e com o ML4ALL.

### Pontos de venda na apresentação

1. **Problema real e mensurável:** elaboração manual de PEI é uma das principais sobrecargas docentes na educação inclusiva no Brasil. Inclusão pelo Parecer 50/2023 ampliou a demanda.
2. **Solução acessível:** ferramenta gratuita, código aberto, opera com LLM grátis.
3. **Conformidade legal:** estruturado a partir do documento normativo federal.
4. **Soberania de dados:** dados do estudante não saem do navegador exceto durante a chamada à LLM.
5. **Humano no loop:** a IA sugere, o docente decide. Posicionamento ético explícito.
6. **Resultados validados:** dados quantitativos de melhoria do tempo + dados qualitativos de aceitação docente.

---

## Trabalho futuro

- [ ] Suporte a múltiplos PEIs por estudante ao longo do ano (acompanhamento longitudinal)
- [ ] Preenchimento automático do parecer "depois" via foto da produção do estudante (multimodal)
- [ ] Biblioteca de materiais sugeridos com geração automática (cartões, versos recortados, etc.)
- [ ] Integração com PDI e PAEE para a tríade completa
- [ ] Versão offline-first (PWA) para escolas com conectividade limitada
- [ ] Benchmark comparativo de LLMs (Llama 3.3, Gemini, Claude, GPT) em qualidade do PEI gerado
- [ ] Painel administrativo para coordenação pedagógica monitorar uso na escola

---

## Licença

MIT.

## Citação

Se este sistema apoiar sua pesquisa, cite o repositório (substitua quando publicar):

```bibtex
@misc{sistema-pei-2026,
  author = {Mayor Martins, R. and colaboradores},
  title  = {Sistema PEI: geração assistida de Planos Educacionais Individualizados},
  year   = {2026},
  url    = {https://github.com/SEU-USUARIO/sistema-pei}
}
```
