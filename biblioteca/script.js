// ===== Configuração =====
const API_URL = "http://localhost:5000/livros"; // rota da API Flask (GET e POST)
const CHAVE_LOCAL = "acervo_biblioteca_demo";   // chave do localStorage (modo demonstração)

// Mesmos dois livros do main.py; usados só no modo demonstração
const LIVROS_INICIAIS = [
  { titulo: "Os Lusíadas", autor: "Luís Vaz de Camões", ano_publicacao: 1572, disponivel: true },
  { titulo: "Mensagem", autor: "Fernando Pessoa", ano_publicacao: 1934, disponivel: false },
];

// true quando a API Flask não está acessível (ex.: página publicada no GitHub Pages)
let modoDemo = false;

// ===== Referências aos elementos do DOM =====
const form = document.getElementById("form-livro");
const campoTitulo = document.getElementById("titulo");
const campoAutor = document.getElementById("autor");
const campoAno = document.getElementById("ano");
const campoDisponivel = document.getElementById("disponivel");
const botaoEnviar = document.getElementById("botao-enviar");
const areaMensagem = document.getElementById("mensagem");
const areaModo = document.getElementById("modo");
const listaLivros = document.getElementById("lista-livros");
const listaVazia = document.getElementById("lista-vazia");
const erroLista = document.getElementById("erro-lista");
const contador = document.getElementById("contador");

// ===== Funções de interface =====

// tipo: "erro", "carregando" ou "sucesso"
function mostrarMensagem(texto, tipo) {
  areaMensagem.textContent = texto; // textContent evita injeção de HTML
  areaMensagem.className = `mensagem ${tipo}`;
  areaMensagem.hidden = false;
}

function esconderMensagem() {
  areaMensagem.hidden = true;
  areaMensagem.textContent = "";
}

function limparMarcacoesDeErro() {
  [campoTitulo, campoAutor, campoAno].forEach((c) => c.classList.remove("invalido"));
}

function marcarInvalido(campo) {
  campo.classList.add("invalido");
  campo.focus();
}

// Atualiza a faixa que mostra se estamos usando a API ou o modo demonstração
function definirModo(demo) {
  modoDemo = demo;
  if (demo) {
    areaModo.className = "modo demo";
    areaModo.textContent =
      "● Modo demonstração: a API Flask não foi encontrada, então os livros ficam salvos só neste navegador. " +
      "Para usar o banco de verdade, rode python app.py.";
  } else {
    areaModo.className = "modo api";
    areaModo.textContent = "● Conectado à API Flask (dados do arquivo acervo_biblioteca.json)";
  }
}

// ===== "Banco" local do modo demonstração (espelha salvar/carregar do Python) =====
function carregarLocal() {
  try {
    const texto = localStorage.getItem(CHAVE_LOCAL);
    return texto ? JSON.parse(texto) : [...LIVROS_INICIAIS];
  } catch {
    return [...LIVROS_INICIAIS]; // localStorage indisponível ou corrompido
  }
}

function salvarLocal(livros) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(livros));
  } catch {
    /* sem localStorage: a lista só vale até recarregar a página */
  }
}

function cadastrarLocal(livro) {
  const livros = carregarLocal();
  const repetido = livros.some(
    (l) =>
      l.titulo.toLowerCase() === livro.titulo.toLowerCase() &&
      l.autor.toLowerCase() === livro.autor.toLowerCase()
  );
  if (repetido) {
    throw new Error("Este livro já está cadastrado.");
  }
  livros.push(livro);
  salvarLocal(livros);
  return { mensagem: `Livro "${livro.titulo}" cadastrado com sucesso!`, livro };
}

// ===== Validação do formulário =====
function validarFormulario() {
  limparMarcacoesDeErro();

  const titulo = campoTitulo.value.trim();
  if (titulo.length < 2) {
    marcarInvalido(campoTitulo);
    throw new Error("Informe o título do livro (mínimo de 2 caracteres).");
  }

  const autor = campoAutor.value.trim();
  if (autor.length < 3) {
    marcarInvalido(campoAutor);
    throw new Error("Informe o nome do autor (mínimo de 3 caracteres).");
  }

  const ano = Number(campoAno.value);
  const anoAtual = new Date().getFullYear();
  if (campoAno.value.trim() === "" || !Number.isInteger(ano) || ano < 1 || ano > anoAtual) {
    marcarInvalido(campoAno);
    throw new Error(`Informe um ano de publicação válido (entre 1 e ${anoAtual}).`);
  }

  return { titulo, autor, ano_publicacao: ano, disponivel: campoDisponivel.checked };
}

// ===== Requisição GET: listar os livros =====
async function listarLivros() {
  try {
    const resposta = await fetch(API_URL);

    // resposta.ok é false para status 400, 404, 500...
    if (!resposta.ok) {
      throw new Error(`Erro ao carregar os livros (código ${resposta.status}).`);
    }

    const livros = await resposta.json(); // JSON -> array de objetos
    definirModo(false);
    erroLista.hidden = true;
    renderizarLista(livros);
  } catch (erro) {
    if (erro instanceof TypeError) {
      // fetch lança TypeError quando não consegue falar com o servidor
      definirModo(true);
      erroLista.hidden = true;
      renderizarLista(carregarLocal());
    } else {
      listaLivros.innerHTML = "";
      listaVazia.hidden = true;
      contador.textContent = "";
      erroLista.textContent = erro.message;
      erroLista.hidden = false;
    }
    console.error("Erro ao listar:", erro);
  }
}

// ===== Requisição POST: cadastrar um livro =====
async function cadastrarLivro(livro) {
  if (modoDemo) {
    return cadastrarLocal(livro);
  }

  const resposta = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" }, // avisa que o corpo é JSON
    body: JSON.stringify(livro),                     // objeto JS -> texto JSON
  });

  // Lê o JSON da resposta (a API também devolve JSON nos erros: {"erro": "..."})
  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new Error(corpo.erro || `Erro ao cadastrar (código ${resposta.status}).`);
  }

  return corpo; // { mensagem, livro }
}

// ===== Montagem da lista no DOM =====
function renderizarLista(livros) {
  listaLivros.innerHTML = ""; // limpa antes de redesenhar
  listaVazia.hidden = livros.length > 0;
  contador.textContent = livros.length ? `· ${livros.length} ${livros.length === 1 ? "livro" : "livros"}` : "";

  // Mais recentes primeiro
  [...livros].reverse().forEach((l) => {
    const li = document.createElement("li");
    li.className = l.disponivel ? "livro" : "livro emprestado";

    const info = document.createElement("div");
    const h3 = document.createElement("h3");
    h3.textContent = l.titulo;
    const p = document.createElement("p");
    p.textContent = `${l.autor} · ${l.ano_publicacao}`;
    info.append(h3, p);

    const selo = document.createElement("span");
    selo.className = l.disponivel ? "selo disponivel" : "selo emprestado";
    selo.textContent = l.disponivel ? "Disponível" : "Emprestado";

    li.append(info, selo);
    listaLivros.appendChild(li);
  });
}

// ===== Evento de envio do formulário =====
form.addEventListener("submit", async (evento) => {
  evento.preventDefault(); // impede o recarregamento da página
  esconderMensagem();

  try {
    const livro = validarFormulario();

    botaoEnviar.disabled = true;
    mostrarMensagem("Cadastrando...", "carregando");

    const resultado = await cadastrarLivro(livro);

    mostrarMensagem(resultado.mensagem, "sucesso");
    form.reset();
    await listarLivros(); // atualiza a lista sem recarregar a página
  } catch (erro) {
    if (erro instanceof TypeError) {
      // A API caiu no meio do uso: a lista passa para o modo demonstração
      mostrarMensagem(
        "A API Flask não respondeu. A página passou para o modo demonstração: clique em Cadastrar novamente para salvar neste navegador.",
        "erro"
      );
      await listarLivros();
    } else {
      mostrarMensagem(erro.message, "erro");
    }
    console.error("Erro no cadastro:", erro);
  } finally {
    botaoEnviar.disabled = false; // executa sempre, com sucesso ou erro
  }
});

// Ao abrir a página, carrega os livros já cadastrados
listarLivros();

/* ===================== CENÁRIOS DE TESTE =====================

   CENÁRIO 1 – ENTRADA VÁLIDA (API Flask rodando: python app.py)
   Título: Dom Casmurro | Autor: Machado de Assis | Ano: 1899 | Disponível marcado
   Esperado: mensagem verde 'Livro "Dom Casmurro" cadastrado com sucesso!',
   o livro aparece no topo da lista sem recarregar a página e fica gravado
   no arquivo acervo_biblioteca.json.

   CENÁRIO 2 – ENTRADAS INVÁLIDAS (simulam erro)
   A) Ano 3000 ou campo de título vazio -> a validação mostra a mensagem
      vermelha antes mesmo de chamar a API.
   B) Repetir "Mensagem" de "Fernando Pessoa" -> a API responde 409 e
      aparece "Este livro já está cadastrado."
   C) Desligar a API (Ctrl+C no terminal) e recarregar a página -> a faixa
      muda para "Modo demonstração" e os livros passam a ser salvos no navegador.

   ============================================================= */