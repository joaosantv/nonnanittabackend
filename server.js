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

// --- Configuração do App ---
const app = express();
const port = process.env.PORT || 3000; // O serviço de deploy define a porta
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// --- Configuração do Banco de Dados ---
const adapter = new FileSync('db.json');
const db = low(adapter);
db.defaults({ reservas: [] }).write();

// --- Limite de Vagas ---
const LIMITE_DE_VAGAS = 10;

// --- Telegram ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
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

// --- Rotas ---
app.get('/', (req, res) => {
  res.send('Servidor da Nonnanitta Café está no ar!');
});

app.post('/reservas', (req, res) => {
  const { 'Data da Reserva': dataReserva, 'Hora da Reserva': horaReserva } = req.body;

  const reservasNoMesmoHorario = db.get('reservas')
    .filter(r => r['Data da Reserva'] === dataReserva && r['Hora da Reserva'] === horaReserva && r.status !== 'Recusada')
    .size()
    .value();

  if (reservasNoMesmoHorario >= LIMITE_DE_VAGAS) {
    console.log(`Reserva RECUSADA por limite de vagas para ${dataReserva} às ${horaReserva}.`);
    return res.status(409).send('Desculpe, não há mais vagas para este horário.');
  }

  const novaReserva = {
    id: shortid.generate(),
    status: 'Pendente',
    data_recebimento: new Date().toISOString(),
    ...req.body
  };
  db.get('reservas').push(novaReserva).write();
  console.log(`Reserva PENDENTE para ${dataReserva} às ${horaReserva}. Aguardando confirmação.`);

  const mensagemTelegram = `*Nova Reserva Pendente!* 🕒\n\n*Nome:* ${novaReserva.Nome}\n*Telefone:* ${novaReserva.Telefone}\n*Data:* ${novaReserva['Data da Reserva']} às ${novaReserva['Hora da Reserva']}\n*Pessoas:* ${novaReserva['Numero de Pessoas']}\n*Observações:* ${novaReserva.Observacoes || 'Nenhuma'}`;
    
  bot.sendMessage(String(CHAT_ID), mensagemTelegram, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[
        { text: '✅ Confirmar', callback_data: `confirmar_${novaReserva.id}` },
        { text: '❌ Recusar', callback_data: `recusar_${novaReserva.id}` }
      ]]
    }
  });

  return res.send('Reserva recebida com sucesso! Em breve você receberá uma confirmação por e-mail.');
});

// --- Handler dos botões no Telegram ---
bot.on('callback_query', async (query) => {
  const { data, message } = query;
  const [acao, idReserva] = data.split('_');
  const reserva = db.get('reservas').find({ id: idReserva }).value();

  if (!reserva || reserva.status !== 'Pendente') {
    return bot.answerCallbackQuery(query.id, { text: `Esta reserva já foi tratada ou não foi encontrada.` });
  }

  const novoStatus = (acao === 'confirmar') ? 'Confirmada' : 'Recusada';
  db.get('reservas').find({ id: idReserva }).assign({ status: novoStatus }).write();

  const emoji = novoStatus === 'Confirmada' ? '✅' : '❌';
  const textoEditado = `*Reserva ${novoStatus.toUpperCase()}!* ${emoji}\n\n*Cliente:* ${reserva.Nome}\n*Data:* ${reserva['Data da Reserva']} às ${reserva['Hora da Reserva']}`;
  
  bot.editMessageText(textoEditado, {
    chat_id: message.chat.id,
    message_id: message.message_id,
    parse_mode: 'Markdown'
  });

  if (reserva.Email) {
    const assunto = `Sua Reserva na Nonna Nita foi ${novoStatus}!`;
    const mensagemEmail = novoStatus === 'Confirmada'
      ? `Olá ${reserva.Nome}, a sua reserva para o dia ${reserva['Data da Reserva']} às ${reserva['Hora da Reserva']} foi CONFIRMADA! Estamos à sua espera.`
      : `Olá ${reserva.Nome}, infelizmente a sua reserva para o dia ${reserva['Data da Reserva']} às ${reserva['Hora da Reserva']} foi RECUSADA. Pedimos desculpas pelo inconveniente.`;
    
    try {
      await transporter.sendMail({
        from: EMAIL_FROM,
        to: reserva.Email,
        subject: assunto,
        text: mensagemEmail
      });
      console.log(`E-mail de ${novoStatus} enviado para ${reserva.Email}`);
    } catch (error) {
      console.error('Erro ao enviar e-mail de confirmação/recusa:', error);
    }
  }

  bot.answerCallbackQuery(query.id, { text: `Reserva ${novoStatus}!` });
});

// --- Iniciar Servidor ---
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

