import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import Joi from "joi"
import dayjs from "dayjs"

//Criação do app
const app = express()

//Configurações
app.use(cors())
app.use(express.json())
dotenv.config()

//Conexão com o Banco
const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db

const promise = mongoClient.connect()
promise.then(() => db = mongoClient.db())
promise.catch((err) => console.log(err.message))

// schemas
const schemaParticipants = Joi.object({ name: Joi.string().required() })
const schemaMessage = Joi.object({
  from: Joi.string().required(),
  to: Joi.string().required(),
  text: Joi.string().required(),
  type: Joi.string().required().valid("message", "private_message")
})


//endpoints
app.post("/participants", async (req, res) => {
  const { name } = req.body

  const validation = schemaParticipants.validate(req.body, { abortEarly: false })

  if (validation.error) {
    return res.status(422).send(validation.error.details.map(detail => detail.message))
  }

  try {
    const participantExists = await db.collection("participants").findOne({ name: name })
    if (participantExists) {
      return res.sendStatus(409)
    }

    await db.collection("participants").insertOne({ name, lastStatus: Date.now() })

    const message = {
      from: name,
      to: 'Todos',
      text: 'entra na sala...',
      type: 'status',
      time: dayjs().format('HH:mm:ss')
    }

    await db.collection("messages").insertOne(message)

    res.sendStatus(201)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

app.get("/participants", async (req, res) => {
  try {
    const participants = await db.collection("participants").find().toArray()
    res.send(participants)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

app.post("/messages", async (req, res) => {
  const { user } = req.headers

  const validation = schemaMessage.validate({ ...req.body, from: user }, { abortEarly: false })
  if (validation.error) {
    return res.status(422).send(validation.error.details.map(detail => detail.message))
  }

  try {
    const participantExists = await db.collection("participants").findOne({ name: user })
    if (!participantExists) {
      return res.sendStatus(422)
    }

    const message = {
      ...req.body,
      from: user,
      time: dayjs().format('HH:mm:ss')
    }

    await db.collection("messages").insertOne(message)
    res.sendStatus(201)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

app.get("/messages", async (req, res) => {
  const { user } = req.headers
  let { limit } = req.query
  if (limit) {
    if (limit <= 0 || isNaN(limit)) {
      return res.sendStatus(422)
    }
  }

  try {
    const messages = await db.collection("messages").find(
      { $or: [{ from: user }, { to: "Todos" }, { to: user }, { type: "message" }] }
    ).toArray()

    if (!limit) return res.send(messages.reverse())
    res.send(messages.slice(-limit).reverse())

  } catch (err) {
    res.status(500).send(err.message)
  }
})

//endpoint status
app.post("/status", async (req, res) => {
  const { user } = req.headers

  if (!user) {
    return res.sendStatus(404)
  }
  try {
    const participant = await db.collection("participants").findOne({ name: user })
    if (!participant) {
      return res.sendStatus(404)
    }
    db.collection("participants").updateOne(
      { name: user },
      { $set: { lastStatus: Date.now() } }
    )
    res.sendStatus(200)
  } catch (err) {
    res.status(500).send(err.message)
  }
})

// deletar participantes inativos
setInterval(async () => {
  const tenSeconds = Date.now() - 10000

  try {
    const notActive = await db.collection("participants").find({ lastStatus: { $lt: tenSeconds } }).toArray()

    if (notActive.lenght > 0) {
      const messages = notActive.map(notActive => {
        return {
          from: notActive.name,
          to: "Todos",
          text: "sai da sala...",
          type: "status",
          time: dayjs().format("HH:mm:ss")
        }
      })
      await db.collection("messages").insertMany(messages)
      await db.collection("participants").deleteMany({ lastStatus: { $lt: tenSeconds } })
    }
  } catch (err) {
    res.status(500).send(err.message)
  }
}, 15000)
// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
