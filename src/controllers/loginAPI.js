const express = require("express");
const sqlConnection = require("../databases/ssmsConn");
const middlewares = require("../middlewares/middlewares.js");

const router = express.Router();


//fetch the Role
router.get("/role", (request, response) => {
  new sqlConnection.sql.Request().query(
    "SELECT [RoleName] FROM [Config_Role]",
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

//fetch the username
router.get("/users", (request, response) => {
  new sqlConnection.sql.Request().query(
    "SELECT [UserName] FROM [Config_User]",
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

//login API
// router.post("", (request, response) => {
//   new sqlConnection.sql.Request().query(
//     "SELECT Count(1) AS temp FROM [Config_User] WHERE UserName = '" +
//       request.body.name +
//       "' AND Password = '" +
//       request.body.pass +
//       "'",
//     (err, result) => {
//       console.log(result.recordset[0].temp);
//       if (err) {
//         middlewares.standardResponse(
//           response,
//           null,
//           300,
//           "Error executing query: " + err
//         );
//         console.error("Error executing query:", err);
//       } else {
//         if (parseInt(result.recordset[0].temp) > 0) {
//           middlewares.standardResponse(response, null, 200, "success");
//         } else {
//           middlewares.standardResponse(
//             response,
//             null,
//             300,
//             "failure/ validation failed"
//           );
//         }
//       }
//     }
//   );
// });

router.post("", async (req, res) => {
  const { roleName, username, password } = req.body;

  if (!roleName || !username || !password) {
    return middlewares.standardResponse(
      res,
      null,
      300,
      "Role, Username and Password are required"
    );
  }

  try {
    const request = new sqlConnection.sql.Request();

    // 1️⃣ Check Role
    request.input("RoleName", sqlConnection.sql.VarChar, roleName);

    const roleResult = await request.query(`
      SELECT RoleID 
      FROM Config_Role 
      WHERE RoleName = @RoleName
    `);

    if (roleResult.recordset.length === 0) {
      return middlewares.standardResponse(
        res,
        null,
        300,
        "Invalid Role"
      );
    }

    const roleId = roleResult.recordset[0].RoleID;

    // 2️⃣ Check Username under Role
    const userRequest = new sqlConnection.sql.Request();
    userRequest.input("UserName", sqlConnection.sql.VarChar, username);
    userRequest.input("RoleID", sqlConnection.sql.Int, roleId);

    const userResult = await userRequest.query(`
      SELECT UserID, Password
      FROM Config_User
      WHERE UserName = @UserName
        AND DepartmentRoleID = @RoleID
    `);

    if (userResult.recordset.length === 0) {
      return middlewares.standardResponse(
        res,
        null,
        300,
        "Invalid Username for selected Role"
      );
    }

    const dbPassword = userResult.recordset[0].Password;

    // 3️⃣ Check Password
    if (dbPassword !== password) {
      return middlewares.standardResponse(
        res,
        null,
        300,
        "Incorrect Password"
      );
    }

    // ✅ SUCCESS
    middlewares.standardResponse(res, null, 200, "Login success");

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
