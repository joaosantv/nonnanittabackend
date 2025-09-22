// --- Executa o código quando o HTML da página terminar de carregar ---
document.addEventListener('DOMContentLoaded', () => {

    // --- LÓGICA DO MENU HAMBÚRGUER (TELEMÓVEL) ---
    const hamburger = document.querySelector(".hamburger");
    const navMenu = document.querySelector(".nav-menu");

    if (hamburger && navMenu) {
        // Alterna a classe 'active' para mostrar/esconder o menu ao clicar
        hamburger.addEventListener("click", () => {
            hamburger.classList.toggle("active");
            navMenu.classList.toggle("active");
        });

        // Fecha o menu quando um link é clicado
        document.querySelectorAll(".nav-link").forEach(n => n.addEventListener("click", () => {
            hamburger.classList.remove("active");
            navMenu.classList.remove("active");
        }));
    }

    // --- LÓGICA DO CARRINHO DE COMPRAS ---
    const carrinho = {}; // Objeto para guardar os itens: { id: { nome, preco, qtd }, ... }
    const botoesAdicionar = document.querySelectorAll('.btn-add');
    const carrinhoItemsContainer = document.getElementById('carrinho-items');
    const carrinhoTotalEl = document.getElementById('carrinho-total-valor');
    const carrinhoVazioEl = document.querySelector('.carrinho-vazio');

    // Função para redesenhar o carrinho na tela
    function atualizarCarrinho() {
        if (!carrinhoItemsContainer || !carrinhoTotalEl) return;

        carrinhoItemsContainer.innerHTML = ''; // Limpa a exibição atual
        let total = 0;
        let temItens = false;

        for (const id in carrinho) {
            temItens = true;
            const item = carrinho[id];
            total += item.preco * item.qtd;

            const itemDiv = document.createElement('div');
            itemDiv.classList.add('carrinho-item');
            itemDiv.innerHTML = `
                <span>${item.qtd}x ${item.nome}</span>
                <span>R$ ${(item.preco * item.qtd).toFixed(2).replace('.', ',')}</span>
            `;
            carrinhoItemsContainer.appendChild(itemDiv);
        }

        // Mostra ou esconde a mensagem "carrinho vazio"
        if (carrinhoVazioEl) {
            carrinhoVazioEl.style.display = temItens ? 'none' : 'block';
        }
        
        carrinhoTotalEl.textContent = total.toFixed(2).replace('.', ',');
    }

    // Adiciona o evento de clique para cada botão "Adicionar" da galeria
    botoesAdicionar.forEach(botao => {
        botao.addEventListener('click', () => {
            const id = botao.dataset.id;
            const nome = botao.dataset.nome;
            const preco = parseFloat(botao.dataset.preco);

            if (carrinho[id]) {
                carrinho[id].qtd++; // Se o item já existe, só aumenta a quantidade
            } else {
                carrinho[id] = { nome, preco, qtd: 1 }; // Se não, adiciona o item
            }
            
            console.log('Carrinho atualizado:', carrinho); // Para depuração
            atualizarCarrinho(); // Redesenha o carrinho com o item novo
        });
    });

    // --- LÓGICA PARA PREPARAR O FORMULÁRIO ANTES DO ENVIO ---
    const formPedido = document.querySelector('.form-pedido');
    if (formPedido) {
        formPedido.addEventListener('submit', () => {
            const itensPedidoInput = document.getElementById('itens-pedido');
            const totalPedidoInput = document.getElementById('total-pedido');

            let itensTexto = '';
            for (const id in carrinho) {
                const item = carrinho[id];
                itensTexto += `${item.qtd}x ${item.nome}\n`; // Cria a lista de itens
            }
            
            // Coloca a lista de itens e o total nos campos escondidos do formulário
            itensPedidoInput.value = itensTexto.trim();
            totalPedidoInput.value = `R$ ${carrinhoTotalEl.textContent}`;
        });
    }

    // --- LÓGICA PARA MOSTRAR FEEDBACK VINDO DO BACKEND ---
    function mostrarFeedback() {
        const urlParams = new URLSearchParams(window.location.search);
        const feedbackReserva = urlParams.get('reserva');
        const feedbackPedido = urlParams.get('pedido');
        
        const reservaFeedbackEl = document.getElementById('reserva-feedback');
        const pedidoFeedbackEl = document.getElementById('pedido-feedback');

        if (feedbackReserva && reservaFeedbackEl) {
            if (feedbackReserva === 'sucesso') {
                reservaFeedbackEl.textContent = 'Solicitação de reserva enviada! Aguarde a confirmação no seu e-mail.';
                reservaFeedbackEl.classList.add('sucesso');
            } else if (feedbackReserva === 'erro') {
                reservaFeedbackEl.textContent = 'Desculpe, não há mais vagas para este horário. Por favor, tente outro.';
                reservaFeedbackEl.classList.add('erro');
            }
        }

        if (feedbackPedido && pedidoFeedbackEl) {
            if (feedbackPedido === 'sucesso') {
                pedidoFeedbackEl.textContent = 'Pedido enviado para a cafetaria! Aguarde o contacto de confirmação.';
                pedidoFeedbackEl.classList.add('sucesso');
            }
        }
    }

    mostrarFeedback();
});

