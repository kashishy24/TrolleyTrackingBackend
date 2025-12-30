const express = require("express");
const sqlConnection = require("../../databases/ssmsConn.js");
const middlewares = require("../../middlewares/middlewares.js");

const router = express.Router();

//---------------- Breakdown Planned & Acknowledged Count ----------------
router.get("/BreakdownPlanAckCount", (request, response) => {
  new sqlConnection.sql.Request().query(
    `
    SELECT
      SUM(CASE WHEN Status = 1 THEN 1 ELSE 0 END) AS PlannedCount,
      SUM(CASE WHEN Status = 2 THEN 1 ELSE 0 END) AS AcknowledgedCount
    FROM Breakdown_Plan
    `,
    (err, result) => {
      if (err) {
        console.error("Breakdown count error:", err);
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
      } else {
        middlewares.standardResponse(
          response,
          result.recordset[0],
          200,
          "success"
        );
        console.dir(result.recordset[0]);
      }
    }
  );
});

//---------------- Completed Breakdown Count (Today) ----------------
router.get("/Breakdown/Completed/TodayCount", (request, response) => {
  const query = `
    SELECT 
      COUNT(*) AS CompletedTodayCount
    FROM History_BreakdownLog
    WHERE Status = 3
      AND CAST([Timestamp] AS DATE) = CAST(GETDATE() AS DATE)
  `;

  new sqlConnection.sql.Request().query(query, (err, result) => {
    if (err) {
      console.error("Completed breakdown count error:", err);
      return middlewares.standardResponse(
        response,
        null,
        300,
        "Error fetching completed breakdown count"
      );
    }

    middlewares.standardResponse(
      response,
      result.recordset[0],
      200,
      "success"
    );
  });
});

//--------------------Plan List Screen-----------------------------
router.get("/BreakdownPlannedTrolleys", (request, response) => {
  new sqlConnection.sql.Request().query(
    `
    SELECT DISTINCT TrolleyID
    FROM Breakdown_Plan
    WHERE Status = 1
    ORDER BY TrolleyID
    `,
    (err, result) => {
      if (err) {
        console.error("Planned trolley list error:", err);
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        console.dir(result.recordset);
      }
    }
  );
});

//---------------- Acknowledge Breakdown Plan ----------------
router.post("/BreakdownPlanAcknowledge", (request, response) => {
  const { trolleyId, userName } = request.body;

  if (!trolleyId || !userName) {
    return middlewares.standardResponse(
      response,
      null,
      300,
      "trolleyId and userName are required"
    );
  }

  const reqObj = new sqlConnection.sql.Request();
  reqObj.input("TrolleyID", sqlConnection.sql.Int, trolleyId);
  reqObj.input("UserName", sqlConnection.sql.NVarChar, userName);

  reqObj.execute(
    "SP_Acknowledge_Breakdown_Plan",
    (err, result) => {
      if (err) {
        console.error("Acknowledge SP error:", err);
        return middlewares.standardResponse(
          response,
          null,
          300,
          "Error acknowledging breakdown plan"
        );
      }

      middlewares.standardResponse(
        response,
        { TrolleyID: trolleyId },
        200,
        "Breakdown plan acknowledged successfully"
      );
    }
  );
});

//------------Acknowledge list Screen ----------------

//---------------- Acknowledged Breakdown Count + List ----------------
router.get("/BreakdownAcknowledgedListandCount", (request, response) => {

  const query = `
    SELECT 
        COUNT(*) AS AcknowledgedCount
    FROM Breakdown_Plan
    WHERE Status = 2;

    SELECT 
        TrolleyID
    FROM Breakdown_Plan
    WHERE Status = 2
    ORDER BY AcknowladgeTime DESC;
  `;

  new sqlConnection.sql.Request().query(query, (err, result) => {
    if (err) {
      console.error("Acknowledged breakdown error:", err);
      return middlewares.standardResponse(
        response,
        null,
        300,
        "Error fetching acknowledged breakdown list"
      );
    }

    const countResult = result.recordsets[0][0]; // first query
    const trolleyList = result.recordsets[1];    // second query

    middlewares.standardResponse(
      response,
      {
        acknowledgedCount: countResult.AcknowledgedCount,
        trolleys: trolleyList.map(item => item.TrolleyID),
      },
      200,
      "success"
    );
  });
});

//Get the trolley information to pass in next screen
//---------------- Breakdown Details by TrolleyID ----------------
router.get("/TrolleyInfoByTrolleyID", (request, response) => {
  const { trolleyId } = request.query;

  if (!trolleyId) {
    return middlewares.standardResponse(
      response,
      null,
      400,
      "trolleyId is required"
    );
  }

  const query = `
    SELECT 
      TrolleyID,
      Reason,
      Remark,
      Status,
      PlanTime,
      AcknowladgeTime,
      UserID
    FROM Breakdown_Plan
    WHERE TrolleyID = @TrolleyID
    ORDER BY PlanTime DESC
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input("TrolleyID", sqlConnection.sql.Int, trolleyId);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      console.error("Breakdown fetch error:", err);
      return middlewares.standardResponse(
        response,
        null,
        300,
        "Error fetching breakdown details"
      );
    }

    middlewares.standardResponse(
      response,
      result.recordset,
      200,
      "success"
    );
  });
});

//------breakdown screen
router.get("/GetAction", (request, response) => {
  new sqlConnection.sql.Request().query(
    "SELECT Action,ActionID FROM [Config_Action]",
    (err, result) => {
      if (err) {
        middlewares.standardResponse(
          response,
          null,
          300,
          "Error executing query: " + err
        );
        console.error("Error executing query:", err);
      } else {
        middlewares.standardResponse(
          response,
          result.recordset,
          200,
          "success"
        );
        console.dir(result.recordset);
      }
    }
  );
});

//---------------- Breakdown History Insert ----------------
router.post("/Breakdown/History/Insert", (request, response) => {
  const {
    trolleyId,
    reason,
    remark,
    planTime,
    acknowladgeTime,
    actionTaken,
    actionRemark,
    userName,
  } = request.body;

  if (!trolleyId || !reason || !acknowladgeTime || !userName) {
    return middlewares.standardResponse(
      response,
      null,
      400,
      "Required fields are missing"
    );
  }

  const sqlReq = new sqlConnection.sql.Request();

  sqlReq.input("TrolleyID", sqlConnection.sql.Int, trolleyId);
  sqlReq.input("Reason", sqlConnection.sql.NVarChar(100), reason);
  sqlReq.input("Remark", sqlConnection.sql.NVarChar(255), remark || null);
  sqlReq.input("PlanTime", sqlConnection.sql.DateTime, planTime || null);
  sqlReq.input("AcknowladgeTime", sqlConnection.sql.DateTime, acknowladgeTime);
  sqlReq.input("ActionTaken", sqlConnection.sql.NVarChar(100), actionTaken || null);
  sqlReq.input("ActionRemark", sqlConnection.sql.NVarChar(255), actionRemark || null);
  sqlReq.input("UserName", sqlConnection.sql.NVarChar(50), userName);

  sqlReq.execute("SP_Insert_Breakdown_History", (err) => {
    if (err) {
      console.error("Breakdown history SP error:", err);
      return middlewares.standardResponse(
        response,
        null,
        300,
        err.message
      );
    }

    middlewares.standardResponse(
      response,
      null,
      200,
      "Breakdown closed and history inserted successfully"
    );
  });
});


router.get("/TrolleyDurationTrolleyID", (request, response) => {
  const { trolleyId } = request.query;

  if (!trolleyId) {
    return middlewares.standardResponse(
      response,
      null,
      400,
      "trolleyId is required"
    );
  }

  const query = `
    SELECT 
      TrolleyID,
      Reason,
      Remark,
      Status,
      PlanTime,
      AcknowladgeTime,
      ActionTaken,
      [ActionRemark],
      [Duration],
      [Timestamp]
    FROM History_BreakdownLog
    WHERE TrolleyID = @TrolleyID
    ORDER BY [Timestamp] DESC
  `;

  const sqlRequest = new sqlConnection.sql.Request();
  sqlRequest.input("TrolleyID", sqlConnection.sql.Int, trolleyId);

  sqlRequest.query(query, (err, result) => {
    if (err) {
      console.error("Breakdown fetch error:", err);
      return middlewares.standardResponse(
        response,
        null,
        300,
        "Error fetching breakdown details"
      );
    }

    middlewares.standardResponse(
      response,
      result.recordset,
      200,
      "success"
    );
  });
});



module.exports = router;
