import express from "express"
import cors from "cors"
import { MongoClient } from "mongodb"

//Criação do app
const app = express()

//Configurações
app.use(cors())
app.use(express.json())

//Conexão com o Banco
const mongoClient = new MongoClient(process.env.DATABASE_URL)
let db 

mongoClient.connect()
    .then(() => db = mongoClient.db())
    .catch((err) => console.log(err.message))


// Ligar a aplicação do servidor para ouvir requisições
const PORT = 5000
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`))
