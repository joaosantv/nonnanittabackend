// --- Carregar variáveis de ambiente ---
require('dotenv').config();

// --- Importações ---
const express = require('express');
const bodyParser = require('body-parser');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const shortid = require('shortid');
const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const cors = require('cors');

// --- Configuração da App ---
const app = express();
const port = process.env.PORT || 3000;
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'https://nonnanitta.netlify.app'
};
app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// --- Configuração do Banco de Dados ---
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ reservas: [], pedidos: [] }).write();

// --- Limite de Vagas ---
const LIMITE_DE_VAGAS = 10;

// --- Credenciais Seguras ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD; // Senha do admin vinda do .env
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// --- Email (Nodemailer) ---
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});
const EMAIL_FROM = process.env.EMAIL_FROM;

// --- Rotas Públicas ---
app.get('/', (req, res) => {
  res.send('Servidor da Nonnanitta Café está no ar!');
});

// Rota para RESERVAS
app.post('/reservas', (req, res) => {
  const { 'Data da Reserva': dataReserva, 'Hora da Reserva': horaReserva, Nome, Telefone } = req.body;
  const reservasNoMesmoHorario = db.get('reservas').filter(r => r['Data da Reserva'] === dataReserva && r['Hora da Reserva'] === horaReserva && r.status !== 'Recusada').size().value();

  if (reservasNoMesmoHorario >= LIMITE_DE_VAGAS) {
    return res.status(409).json({ message: 'Desculpe, não há mais vagas para este horário.' });
  }

  const novaReserva = { id: shortid.generate(), status: 'Pendente', ...req.body };
  db.get('reservas').push(novaReserva).write();
  console.log(`Reserva PENDENTE para ${Nome}.`);
  
  const telefoneLimpo = Telefone.replace(/\D/g, '');
  const mensagemWhats = `Olá ${Nome}! Sobre sua reserva na Nonna Nita...`;
  const linkWhatsApp = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagemWhats)}`;
  const mensagemTelegram = `*Nova Reserva Pendente!* 🕒\n\n*Nome:* ${Nome}\n*Telefone:* ${Telefone}\n*Data:* ${dataReserva} às ${horaReserva}\n*Pessoas:* ${novaReserva['Numero de Pessoas']}\n\n[➡️ Responder via WhatsApp](${linkWhatsApp})`;
    
  bot.sendMessage(String(CHAT_ID), mensagemTelegram, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: [[{ text: '✅ Confirmar', callback_data: `reserva_confirmar_${novaReserva.id}` }, { text: '❌ Recusar', callback_data: `reserva_recusar_${novaReserva.id}` }]] }
  });

  return res.status(200).json({ message: 'Solicitação de reserva enviada com sucesso!' });
});

// Rota para PEDIDOS
app.post('/pedidos', (req, res) => {
    const { Nome, Telefone, 'Hora de Retirada': horaRetirada } = req.body;
    const novoPedido = { id: shortid.generate(), status: 'Pendente', ...req.body };
    db.get('pedidos').push(novoPedido).write();
    console.log(`Pedido PENDENTE de ${Nome}.`);

    const telefoneLimpo = Telefone.replace(/\D/g, '');
    const mensagemWhats = `Olá ${Nome}! Sobre seu pedido na Nonna Nita...`;
    const linkWhatsApp = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(mensagemWhats)}`;
    const mensagemTelegram = `*Novo Pedido para Retirada!* 🛍️\n\n*Cliente:* ${Nome}\n*Telefone:* ${Telefone}\n*Horário de Retirada:* ${horaRetirada}\n\n*Itens:*\n${novoPedido['Itens do Pedido']}\n\n*Total:* ${novoPedido['Total do Pedido']}\n\n[➡️ Responder via WhatsApp](${linkWhatsApp})`;
    bot.sendMessage(String(CHAT_ID), mensagemTelegram, {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '✅ Confirmar', callback_data: `pedido_confirmar_${novoPedido.id}` }, { text: '❌ Recusar', callback_data: `pedido_recusar_${novoPedido.id}` }]] }
    });

    return res.status(200).json({ message: 'Pedido enviado com sucesso!' });
});


// --- ROTA DE LOGIN DO ADMIN (NOVA) ---
app.post('/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        // Se a senha estiver correta, envia uma resposta de sucesso.
        res.status(200).json({ success: true, message: 'Login bem-sucedido' });
    } else {
        // Se a senha estiver incorreta, envia um erro.
        res.status(401).json({ success: false, message: 'Senha incorreta' });
    }
});
// ------------------------------------

// --- ROTA PROTEGIDA PARA O PAINEL DE ADMINISTRAÇÃO ---
app.get('/admin/dados', (req, res) => {
    // No futuro, adicionaríamos um token JWT aqui para mais segurança.
    const reservas = db.get('reservas').value();
    const pedidos = db.get('pedidos').value();
    res.json({ reservas, pedidos });
});
// ---------------------------------------------------

// --- Handler dos botões no Telegram ---
bot.on('callback_query', async (query) => {
    const { data, message } = query;
    const [tipo, acao, id] = data.split('_'); 
    const collection = tipo === 'reserva' ? 'reservas' : 'pedidos';
    const item = db.get(collection).find({ id }).value();

    if (!item || item.status !== 'Pendente') {
        return bot.answerCallbackQuery(query.id, { text: `Este ${tipo} já foi tratado.` });
    }

    const novoStatus = (acao === 'confirmar') ? 'Confirmado' : 'Recusado';
    db.get(collection).find({ id }).assign({ status: novoStatus }).write();

    const emoji = novoStatus === 'Confirmado' ? '✅' : '❌';
    let textoEditado = `*${tipo.toUpperCase()} ${novoStatus.toUpperCase()}!* ${emoji}\n\n*Cliente:* ${item.Nome}`;
    
    const telefoneLimpo = item.Telefone.replace(/\D/g, '');
    const msgWhats = `Olá ${item.Nome}! O seu ${tipo} na Nonna Nita foi ${novoStatus}.`;
    const linkWhatsApp = `https://wa.me/55${telefoneLimpo}?text=${encodeURIComponent(msgWhats)}`;
    textoEditado += `\n[Continuar no WhatsApp](${linkWhatsApp})`;
    
    bot.editMessageText(textoEditado, { chat_id: message.chat.id, message_id: message.message_id, parse_mode: 'Markdown' });

    if (tipo === 'reserva' && item.Email) {
        const assunto = `Sua reserva na Nonna Nita foi ${novoStatus}!`;
        const mensagemEmail = novoStatus === 'Confirmado'
          ? `Olá ${item.Nome}, a sua reserva para o dia ${item['Data da Reserva']} às ${item['Hora da Reserva']} foi CONFIRMADA! Estamos à sua espera.`
          : `Olá ${item.Nome}, infelizmente a sua reserva para o dia ${item['Data da Reserva']} às ${item['Hora da Reserva']} foi RECUSADA. Pedimos desculpas pelo inconveniente.`;
        
        try {
          await transporter.sendMail({ from: EMAIL_FROM, to: item.Email, subject: assunto, text: mensagemEmail });
        } catch (error) {
          console.error(`Erro ao enviar e-mail de ${tipo}:`, error);
        }
    }
    
    bot.answerCallbackQuery(query.id, { text: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} ${novoStatus}!` });
});

// --- Iniciar Servidor ---
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

