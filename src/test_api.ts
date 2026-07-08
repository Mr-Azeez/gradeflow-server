import jwt from "jsonwebtoken";
import http from "http";

const JWT_SECRET = process.env.JWT_SECRET || "gradeflow_super_secret_key_2024";
const userId = "8b00a95f-9a69-47a8-8618-2f56e7e8ae87";

const postRequest = (path: string, token: string, body: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
};

const putRequest = (path: string, token: string, body: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path: path,
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "Content-Length": Buffer.byteLength(postData),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      }
    );
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
};

const deleteRequest = (path: string, token: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path: path,
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
};

async function run() {
  try {
    console.log(`Using hardcoded test user ID: ${userId}`);

    // Generate token
    const token = jwt.sign({ userId }, JWT_SECRET);

    // Test POST /semesters (Create)
    console.log("Testing POST /semesters (Creating level 300, semester 2)...");
    const createRes = await postRequest("/semesters", token, {
      academic_year: "2026/2027",
      level: 300,
      semester_number: 2,
      name: "Arbitrary name that should be ignored", // should be ignored by server
    });

    console.log("Create response:", createRes);
    if (createRes.status !== 201) {
      throw new Error(`Failed to create semester: status ${createRes.status}`);
    }
    if (createRes.body.name !== "300L - Second Semester") {
      throw new Error(`Derived name mismatch! Expected '300L - Second Semester', got '${createRes.body.name}'`);
    }
    console.log("POST SUCCESS: Semester created and name derived correctly!");

    const semesterId = createRes.body.id;

    // Test PUT /semesters/:id (Update)
    console.log(`Testing PUT /semesters/${semesterId} (Updating to level 400, semester 1)...`);
    const updateRes = await putRequest(`/semesters/${semesterId}`, token, {
      academic_year: "2026/2027",
      level: 400,
      semester_number: 1,
      name: "Another ignored name", // should be ignored by server
    });

    console.log("Update response:", updateRes);
    if (updateRes.status !== 200) {
      throw new Error(`Failed to update semester: status ${updateRes.status}`);
    }
    if (updateRes.body.name !== "400L - First Semester") {
      throw new Error(`Derived name mismatch after update! Expected '400L - First Semester', got '${updateRes.body.name}'`);
    }
    console.log("PUT SUCCESS: Semester updated and name derived correctly!");

    // Clean up by deleting the created test semester
    console.log("Cleaning up created semester...");
    const deleteRes = await deleteRequest(`/semesters/${semesterId}`, token);
    console.log("Delete response:", deleteRes);

    console.log("ALL TESTS COMPLETED SUCCESSFULLY!");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

run();
