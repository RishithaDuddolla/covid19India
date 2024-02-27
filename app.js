const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const dbpath = path.join(__dirname, 'covid19IndiaPortal.db')
const app = express()
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
let db = null
app.use(express.json())
const makeDbConnection = async () => {
  try {
    db = await open({
      filename: dbpath,
      driver: sqlite3.Database,
    })
    app.listen(3000)
  } catch (e) {
    console.log(`couldn't connect ${e.message}`)
  }
}
makeDbConnection()
const convertToCamel = dbobject => {
  return {
    stateId: dbobject.state_id,
    stateName: dbobject.state_name,
    population: dbobject.population,
  }
}
const convertToCameld = dbobject => {
  return {
    districtId: dbobject.district_id,
    districtName: dbobject.district_name,
    stateId: dbobject.state_id,
    cases: dbobject.cases,
    cured: dbobject.cured,
    active: dbobject.active,
    deaths: dbobject.death,
  }
}
const AuthenticateUser = (request, response, next) => {
  const accessTokenPresent = request.headers['authorization']
  let accessToken
  if (accessTokenPresent !== undefined) {
    accessToken = accessTokenPresent.split(' ')[1]
  }
  if (accessToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(accessToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const dbquery1 = `select * from user where username= "${username}";`
  const dbresponse1 = await db.get(dbquery1)
  if (dbresponse1 === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const comparision = await bcrypt.compare(password, dbresponse1.password)
    if (comparision) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})
app.get('/states/', AuthenticateUser, async (request, response) => {
  const dbquery = `select * from state;`
  const dbresponse = await db.all(dbquery)
  response.send(dbresponse.map(eachState => convertToCamel(eachState)))
})
app.get('/states/:stateId', AuthenticateUser, async (request, response) => {
  const {stateId} = request.params
  const dbquery = `select * from state where state_Id=${stateId};`
  const dbresponse = await db.get(dbquery)
  response.send(convertToCamel(dbresponse))
})
app.post('/districts/', AuthenticateUser, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const dbquery = `insert into district (district_name,state_id,cases,cured,active,deaths) values ("${districtName}",${stateId},${cases},${cured},${active},${deaths});`
  await db.run(dbquery)
  response.send('District Successfully Added')
})
app.get(
  '/districts/:districtId',
  AuthenticateUser,
  async (request, response) => {
    const {districtId} = request.params
    const dbquery = `select * from district where district_id=${districtId};`
    const dbresponse = await db.get(dbquery)
    response.send(convertToCameld(dbresponse))
  },
)
app.delete(
  '/districts/:districtId/',
  AuthenticateUser,
  async (request, response) => {
    const {districtId} = request.params
    const dbquery = `delete from district where district_id=${districtId};`
    await db.run(dbquery)
    response.send('District Removed')
  },
)
app.put(
  '/districts/:districtId/',
  AuthenticateUser,
  async (request, resposne) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const dbquery = `update district set district_name="${districtName}", state_id=${stateId}, cases=${cases}, cured=${cured}, active=${active}, deaths=${deaths} where district_id=${districtId};`
    await db.run(dbquery)
    resposne.send('District Details Updated')
  },
)
app.get(
  '/states/:stateId/stats/',
  AuthenticateUser,
  async (request, response) => {
    const {stateId} = request.params
    const dbquery = `select sum(cases) as totalCases,sum(cured) as totalCured,sum(active) as totalActive,sum(deaths) as totalDeaths from district where state_id=${stateId};`
    const dbresponse = await db.get(dbquery)
    response.send(dbresponse)
  },
)
module.exports = app
