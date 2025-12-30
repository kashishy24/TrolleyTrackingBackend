const express = require("express");
const sql = require("mssql"); // ✅ REQUIRED
const dbConfig = require("../../databases/ssmsConn"); // ✅ REQUIRED
const router = express.Router();

// GET latest trolley maintenance data
router.get("/maintenance/:trolleyId?", async (req, res) => {
  try {
    const { trolleyId } = req.params;

    const pool = await sql.connect(dbConfig);

    let query = `
      SELECT 
          t.TrolleyID,
          t.TrolleyStatus,
          t.LocationStatus,
          t.PMStatus,
          ms.LastCompletedDate,
          ms.Status AS MaintenanceStatus,
          ms.LastUpdatedTime AS MaintenanceLastUpdatedTime
      FROM Config_Trolley t
      OUTER APPLY (
          SELECT TOP 1 *
          FROM Config_Maintenance_Schedule ms
          WHERE ms.TrolleyID = t.TrolleyID
          ORDER BY ms.LastUpdatedTime DESC
      ) ms
    `;

    if (trolleyId) {
      query += ` WHERE t.TrolleyID = @TrolleyID `;
    }

    query += `
      ORDER BY ISNULL(ms.LastUpdatedTime, t.LastUpdatedTime) DESC
    `;

    const request = pool.request();

    if (trolleyId) {
      request.input("TrolleyID", sql.NVarChar(50), trolleyId);
    }

    const result = await request.query(query);

    return res.status(200).json({
      success: true,
      count: result.recordset.length,
      data: result.recordset,
    });

  } catch (error) {
    console.error("Trolley Maintenance API Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

// PM Acknowledge API
router.post("/acknowledge", async (req, res) => {
  const { TrolleyID, UserID } = req.body;

  if (!TrolleyID || !UserID) {
    return res.status(400).json({
      success: false,
      message: "TrolleyID and UserID are required",
    });
  }

  try {
    const pool = await sql.connect(dbConfig);

    await pool
      .request()
      .input("TrolleyID", sql.NVarChar(50), TrolleyID)
      .input("UserID", sql.NVarChar(20), UserID)
      .execute("PM_Acknowladge");

    return res.status(200).json({
      success: true,
      message: "PM Acknowledged Successfully",
    });

  } catch (error) {
    console.error("PM Acknowledge Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});

router.get('/checklist', async (req, res) => {
  try {
    const pool = await sql.connect(dbConfig);

    const result = await pool.request().query(`
      SELECT 
        CL.CheckListID,
        CL.CheckListName,
        CP.CheckPointID,
        CP.CheckPointName
      FROM Exec_Maint_Checklist CL
      INNER JOIN Exec_Maint_CheckPoint CP
        ON CL.CheckListID = CP.CheckListID
      ORDER BY CL.CheckListID, CP.CheckPointID
    `);

    // 🔹 Group by Checklist
    const grouped = {};
    result.recordset.forEach(row => {
      if (!grouped[row.CheckListID]) {
        grouped[row.CheckListID] = {
          category: row.CheckListName,
          checkpoints: [],
        };
      }

      grouped[row.CheckListID].checkpoints.push({
        id: row.CheckPointID,
        name: row.CheckPointName,
      });
    });

    res.json({
      success: true,
      data: Object.values(grouped),
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

//Update API to update the OKNOK and obeservation

router.post('/update-checkpoints', async (req, res) => {
  const { TrolleyID, UserID, checkpoints } = req.body;

  if (!TrolleyID || !UserID || !Array.isArray(checkpoints)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid payload',
    });
  }

  try {
    const pool = await sql.connect(dbConfig);
    const transaction = new sql.Transaction(pool);

    await transaction.begin();

    for (const cp of checkpoints) {
      await transaction.request()
        .input('CheckPointID', sql.Int, cp.CheckPointID)
        .input('Status', sql.Int, cp.Status)       // 1 = OK, 2 = NOK
        .input('Remark', sql.NVarChar, cp.Remark ?? '')
        .query(`
          UPDATE Exec_Maint_CheckPoint
          SET
            Status = @Status,
            Remark = @Remark,
            LastUpdatedTime = GETDATE()
          WHERE CheckPointID = @CheckPointID
        `);
    }

    await transaction.commit();

    res.json({
      success: true,
      message: 'All checkpoints updated successfully',
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: 'Database error',
    });
  }
});



/* --------------------------------------------------
   PM APPROVED API
-------------------------------------------------- */
router.post("/approve", async (req, res) => {
  const { TrolleyID, UserID } = req.body;

  // 🔹 Validation
  if (!TrolleyID || !UserID) {
    return res.status(400).json({
      success: false,
      message: "TrolleyID and UserID are required",
    });
  }

  try {
    const pool = await sql.connect(dbConfig);

    await pool.request()
      .input("TrolleyID", sql.NVarChar(50), TrolleyID)
      .input("UserID", sql.NVarChar(20), UserID)
      .execute("PM_Approved");

    return res.status(200).json({
      success: true,
      message: "PM Approved Successfully",
    });

  } catch (error) {
    console.error("PM Approved Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
      error: error.message,
    });
  }
});


module.exports = router;
