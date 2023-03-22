const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();
app.use(express.json());
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:/3000/");
    });
  } catch (e) {
    console.log(`DB ERROR ${e.message}`);
  }
};

initializeDBAndServer();

const convertStateDBObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDistrictDBObjectToResponseObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

const convertStatisticsDbObjectToResponseObject = (eachCase) => {
  return {
    totalCases: eachCase.total_cases,
    totalCured: eachCase.total_cured,
    totalActive: eachCase.total_active,
    totalDeaths: eachCase.total_deaths,
  };
};

//malware function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "asdfgfhllkjhjiouy", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//GET API

app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT * FROM state ORDER BY state_id;`;

  const statesArray = await db.all(getStatesQuery);
  response.send(
    statesArray.map((eachState) =>
      convertStateDBObjectToResponseObject(eachState)
    )
  );
});

//GET STATE BY ID API

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
    SELECT * FROM state WHERE state_id = ${stateId};`;
  const stateArray = await db.get(getStateQuery);
  response.send(convertStateDBObjectToResponseObject(stateArray));
});

// API USER LOGIN

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "asdfgfhllkjhjiouy");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//POST API

app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const postDistrictQuery = `
  INSERT INTO
    district ( district_name, state_id, cases,cured,active,deaths)
  VALUES
    ('${districtName}', ${stateId}, ${cases},${cured},${active},${deaths});`;

  await db.run(postDistrictQuery);
  response.send("District Successfully Added");
});

// GET districts API

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT * FROM district 
    WHERE district_id = ${districtId};`;

    const districtArray = await db.get(getDistrictQuery);
    response.send(convertDistrictDBObjectToResponseObject(districtArray));
  }
);

//DELETE district API

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    try {
      const { districtId } = request.params;
      const deleteDistrictQuery = `
    DELETE FROM district WHERE district_id = ${districtId};`;
      await db.run(deleteDistrictQuery);
      response.send("District Removed");
    } catch (e) {
      console.log(`${e.message}`);
    }
  }
);

//PUT district API

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;

    const updateDistrictQuery = `
    UPDATE district SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured}, 
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

//API 8

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStatisticsQuery = `
    SELECT SUM(cases) AS total_cases,
    SUM(cured) AS total_cured,
    SUM(active) AS total_active,
    SUM(deaths) AS total_deaths
    FROM district WHERE state_id = ${stateId};`;
    const statisticsArray = await db.get(getStatisticsQuery);
    response.send(convertStatisticsDbObjectToResponseObject(statisticsArray));
  }
);

module.exports = app;
