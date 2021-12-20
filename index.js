const express = require('express')
const sqlite3 = require('sqlite3')
const TelegramBot = require('node-telegram-bot-api')

const port = process.env.PORT || 3000

// init express
const app = express()

// init bot
const BOT_TOKEN = '<YOUR_BOT_TOKEN>'
const PAYMENT_TOKEN = '<YOUR_PAYMENT_TOKEN>'
const telegramBot = new TelegramBot(BOT_TOKEN, { polling: true })

// init db
const db = new sqlite3.Database('./db/database.sqlite')

// set error callbacks
telegramBot.on('error', msg => console.log(`[bot] error:`, msg))
telegramBot.on('polling_error', msg => console.log(`[bot] polling_error:`, msg))
telegramBot.on('webhook_error', msg => console.log(`[bot] webhook_error:`, msg))

// set command
telegramBot.setMyCommands([{ command: 'list', description: 'Show all products' }])

// product list
telegramBot.onText(/\/list/, async (msg, match) => {
  db.all('SELECT * FROM items', [], (err, items) => {
    if (err) {
      console.log('[bot] list items error:', err)
      return
    }

    try {
      telegramBot.sendMessage(msg.chat.id, 'Select a product', {
        reply_markup: {
          inline_keyboard: [
            ...items.map(p => [{ text: p.name, callback_data: p.id }])
          ]
        }
      })
    } catch (err) {
      telegramBot.sendMessage(msg.chat.id, 'Ops, there was an error!')
    }
  })
})

// product selection
telegramBot.on('callback_query', async (query) => {
  console.log('[bot] query', query)

  // retrieve product
  db.get(`SELECT * FROM items WHERE id = ${query.data}`, [], (err, item) => {
    if (err) {
      console.log('[bot] find item error:', err)
      return
    }

    telegramBot.sendInvoice(
      query.message.chat.id,   // Telegram chat ID
      item.name,               // item Name
      'Awesome description',   // item description
      'payload',               // payload (needed for internal processes, such as creating orders on our db)
      PAYMENT_TOKEN,           // the payment token provided by BotFather after connecting Stripe
      'purchase_deep_linking', // parameter for deep linking (not used in this tutorial)
      'USD',                   // currency
      [{ label: item.name, amount: item.price }], // label shown to the customer
      { photo_url: 'https://placekitten.com/200/300', need_shipping_address: true }) // photo and require shipping info
  })
})

// payment callbacks
telegramBot.on('pre_checkout_query', (query) => {
  console.log(`[bot] pre checkout`)
  console.log(query)

  telegramBot.answerPreCheckoutQuery(query.id, true)
})

telegramBot.on('successful_payment', (msg) => {
  console.log(`[bot] successful payment`)
  console.log('Successful Payment', msg)

  telegramBot.sendMessage(msg.chat.id, 'Thank you for your purchase!')
})

app.listen(port, () => console.log(`Telegram ShopBot listening at http://localhost:${port}`))
