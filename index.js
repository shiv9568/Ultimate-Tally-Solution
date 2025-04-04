const axios = require("axios");
const fs = require("fs");
const csvParser = require("csv-parser");

const TALLY_URL = "http://localhost:9000";
const COMPANY_NAME = "Shivansh"; // Tally company name

// Step 1: Read CSV
async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    let data = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (row) => data.push(row))
      .on("end", () => resolve(data))
      .on("error", (error) => reject(error));
  });
}

// Step 2: Create Ledger
async function createLedger(ledgerName, isParty = true) {
  const xml = `
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC><REPORTNAME>All Masters</REPORTNAME></REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${ledgerName}" RESERVEDNAME="">
            <PARENT>${isParty ? "Sundry Debtors" : "Sales Accounts"}</PARENT>
            <ISBILLWISEON>Yes</ISBILLWISEON>
            <AFFECTSGST>Yes</AFFECTSGST>
            <ISPARTYLEDGER>${isParty ? "Yes" : "No"}</ISPARTYLEDGER>
            <OPENINGBALANCE>0</OPENINGBALANCE>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
  `;

  try {
    const response = await axios.post(TALLY_URL, xml, { headers: { "Content-Type": "text/xml" } });
    console.log(`✅ Ledger Created: ${ledgerName}`);
  } catch (error) {
    console.error(`❌ Ledger Error for ${ledgerName}:`, error.message);
  }
}

// Step 3: Create Voucher
async function createVoucher(date, partyLedger, salesLedger, amount) {
  const xml = `
<ENVELOPE>
  <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${COMPANY_NAME}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
            <DATE>${date}</DATE>
            <NARRATION>Sales Entry</NARRATION>
            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
            <PARTYLEDGERNAME>${partyLedger}</PARTYLEDGERNAME>
            <PERSISTEDVIEW>Invoice Voucher View</PERSISTEDVIEW>
            <ISINVOICE>Yes</ISINVOICE>
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${partyLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${amount}</AMOUNT>
            </LEDGERENTRIES.LIST>
            <LEDGERENTRIES.LIST>
              <LEDGERNAME>${salesLedger}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${amount}</AMOUNT>
            </LEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
  `;

  try {
    const response = await axios.post(TALLY_URL, xml, { headers: { "Content-Type": "text/xml" } });
    console.log(`📨 Tally Response:\n${response.data}`);

    // Error extraction
    const match = response.data.match(/<LINEERROR>(.*?)<\/LINEERROR>/);
    if (match) {
      console.error(`❌ Tally XML Error: ${match[1]}`);
    } else {
      console.log(`✅ Voucher Created: ${partyLedger} - ₹${amount}`);
    }
  } catch (error) {
    console.error(`❌ Voucher Error:`, error.message);
  }
}

// Step 4: Format Date (dd-mm-yyyy → yyyymmdd)
function formatDate(dateStr) {
  const [day, month, year] = dateStr.split("-");
  return `${year}${month}${day}`;
}

// Step 5: Process
async function processCSV() {
  console.log("📂 Reading CSV...");
  const transactions = await readCSV("data.csv");

  for (const { Date, PartyLedger, SalesLedger, Amount } of transactions) {
    console.log(`\n📌 Processing: ${PartyLedger} | ${SalesLedger} | ₹${Amount}`);

    await createLedger(PartyLedger, true);
    await createLedger(SalesLedger, false);
    await createVoucher(formatDate(Date), PartyLedger, SalesLedger, Amount);
  }

  console.log("\n✅ All Transactions Processed!");
}

// Run
processCSV().catch(console.error);
