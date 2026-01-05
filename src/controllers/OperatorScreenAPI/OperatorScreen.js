
const express = require("express");
const sqlConnection = require("../../databases/ssmsConn");
const middlewares = require("../../middlewares/middlewares.js");
const router = express.Router();

//API For trolley tracking screen
router.get("/GetTrolleyTrackingValue", async (req, res) => {
  try {
    const result = await new sqlConnection.sql.Request()
      .execute("SP_Get_Trolley_TrackingValue");

    middlewares.standardResponse(
      res,
      result.recordset[0],
      200,
      "success"
    );
  } catch (err) {
    console.error(err);
    middlewares.standardResponse(res, null, 300, "Database error");
  }
});

// ------------------- get the trolley  status screen --------------------------------------
router.get("/GetTrolleyStatus/:trolleyId", async (req, res) => {
  const { trolleyId } = req.params;

  if (!trolleyId) {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "TrolleyID is required"
    );
  }

  try {
    const request = new sqlConnection.sql.Request();
    request.input("TrolleyID", sqlConnection.sql.Int, trolleyId);

    const result = await request.execute("SP_Get_Trolley_Status_ByID");

    if (result.recordset.length === 0) {
      return middlewares.standardResponse(
        res,
        null,
        300,
        "Trolley not found"
      );
    }

    middlewares.standardResponse(
      res,
      result.recordset[0],
      200,
      "success"
    );
  } catch (err) {
    console.error(err);
    middlewares.standardResponse(res, null, 300, "Database error");
  }
});

//get the locations and trolley status
router.get("/GetLocationStatus", async (req, res) => {
  try {
    const result = await new sqlConnection.sql.Request()
      .execute("SP_Get_Trolley_Location_And_Status");

    middlewares.standardResponse(
      res,
      {
        locations: result.recordsets[0], // first SELECT
        statuses: result.recordsets[1]   // second SELECT
      },
      200,
      "success"
    );
  } catch (err) {
    console.error(err);
    middlewares.standardResponse(res, null, 300, "Database error");
  }
});

//Update API to update the location and status

router.post("/update-trolley-status", async (req, res) => {
  const {
    trolleyId,
    newLocationStatus,
    newTrolleyStatus,
    updatedBy
  } = req.body;

  if (!trolleyId || !updatedBy) {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "TrolleyID and UpdatedBy are required"
    );
  }

  if (!newLocationStatus && !newTrolleyStatus) {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "Provide Location or Status to update"
    );
  }

  try {
    const request = new sqlConnection.sql.Request();

    request.input("TrolleyID", sqlConnection.sql.Int, trolleyId);
    request.input(
      "NewLocationStatus",
      sqlConnection.sql.Int,
      newLocationStatus || null
    );
    request.input(
      "NewTrolleyStatus",
      sqlConnection.sql.Int,
      newTrolleyStatus || null
    );
    request.input("UpdatedBy", sqlConnection.sql.VarChar, updatedBy);

    await request.execute("SP_Update_Trolley_Location_Status");

    middlewares.standardResponse(
      res,
      null,
      200,
      "Trolley updated successfully"
    );
  } catch (err) {
    console.error(err);

    middlewares.standardResponse(
      res,
      null,
      300,
      err.message || "Database error"
    );
  }
});

//----------------------------Trolley Maintenance Screen------------

router.get("/trolley/current-status/:trolleyId", async (req, res) => {
  const { trolleyId } = req.params;

  if (!trolleyId) {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "TrolleyID is required"
    );
  }

  try {
    const request = new sqlConnection.sql.Request();
    request.input("TrolleyID", sqlConnection.sql.Int, trolleyId);

    const result = await request.query(`
      SELECT
        TrolleyID,
        LocationStatus,
        TrolleyStatus
      FROM Config_Trolley
      WHERE TrolleyID = @TrolleyID
    `);

    if (result.recordset.length === 0) {
      return middlewares.standardResponse(
        res,
        null,
        300,
        "Trolley not found"
      );
    }

    middlewares.standardResponse(
      res,
      result.recordset[0],
      200,
      "success"
    );
  } catch (err) {
    console.error(err);
    middlewares.standardResponse(
      res,
      null,
      300,
      "Database error"
    );
  }
});

//Get te breakdown reasons

router.get("/breakdown-reasons", async (req, res) => {
  try {
    const request = new sqlConnection.sql.Request();

    const result = await request.query(`
      SELECT
        ReasonID,
        BreakdownReason,
        ReasonDescription
      FROM Config_BreakDownReason
      ORDER BY ReasonID
    `);

    middlewares.standardResponse(
      res,
      result.recordset,
      200,
      "success"
    );
  } catch (err) {
    console.error(err);
    middlewares.standardResponse(
      res,
      null,
      300,
      "Database error"
    );
  }
});

//Update Breakdown reason and remark
router.post("/breakdown/update", async (req, res) => {
  const { trolleyId, reason, remark, UserName } = req.body;

  if (!trolleyId || !reason || !UserName) {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "TrolleyID, Reason and UserName are required"
    );
  }

  try {
    const request = new sqlConnection.sql.Request();

    request.input("TrolleyID", sqlConnection.sql.Int, trolleyId);
    request.input("Reason", sqlConnection.sql.NVarChar(100), reason);
    request.input("Remark", sqlConnection.sql.NVarChar(255), remark || null);
    request.input("UserName", sqlConnection.sql.NVarChar(50), UserName);

    await request.execute("SP_Update_Breakdown_Plan");

    middlewares.standardResponse(
      res,
      null,
      200,
      "Breakdown updated successfully"
    );
  } catch (err) {
    console.error(err);

    middlewares.standardResponse(
      res,
      null,
      300,
      err.message || "Database error"
    );
  }
});

//====================Trolley History Screen===========

router.get("/trolley/history", async (req, res) => {
  const { trolleyId, mode } = req.query;

  if (!trolleyId || !mode) {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "TrolleyID and mode are required"
    );
  }

  let selectQuery = "";

  // Decide query based on button clicked
  if (mode === "location") {
    selectQuery = `
      SELECT TOP 50
        TrolleyID,
        LocationStatus,
        CONVERT(varchar(19), Timestamp, 126) AS Timestamp
      FROM Trolley_Genealogy
      WHERE TrolleyID = @TrolleyID
      ORDER BY [Timestamp] DESC
    `;
  } else if (mode === "status") {
    selectQuery = `
      SELECT TOP 50
        TrolleyID,
        TrolleyStatus,
     CONVERT(varchar(19), Timestamp, 126) AS Timestamp
      FROM Trolley_Genealogy
      WHERE TrolleyID = @TrolleyID
      ORDER BY [Timestamp] DESC
    `;
  } else {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "Invalid mode. Use location or status"
    );
  }

  try {
    const request = new sqlConnection.sql.Request();
    request.input("TrolleyID", sqlConnection.sql.Int, trolleyId);

    const result = await request.query(selectQuery);

    middlewares.standardResponse(
      res,
      result.recordset,
      200,
      "success"
    );
  } catch (err) {
    console.error(err);
    middlewares.standardResponse(
      res,
      null,
      300,
      "Database error"
    );
  }
});

module.exports = router;