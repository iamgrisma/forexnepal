import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// --- CURRENCIES List (Must match worker) ---
const CURRENCY_MAP: { [key: string]: { name: string, unit: number } } = {
    'INR': { name: 'Indian Rupee', unit: 100 },
    'USD': { name: 'U.S. Dollar', unit: 1 },
    'EUR': { name: 'European Euro', unit: 1 },
    'GBP': { name: 'UK Pound Sterling', unit: 1 },
    'CHF': { name: 'Swiss Franc', unit: 1 },
    'AUD': { name: 'Australian Dollar', unit: 1 },
    'CAD': { name: 'Canadian Dollar', unit: 1 },
    'SGD': { name: 'Singapore Dollar', unit: 1 },
    'JPY': { name: 'Japanese Yen', unit: 10 },
    'CNY': { name: 'Chinese Yuan', unit: 1 },
    'SAR': { name: 'Saudi Arabian Riyal', unit: 1 },
    'QAR': { name: 'Qatari Riyal', unit: 1 },
    'THB': { name: 'Thai Baht', unit: 1 },
    'AED': { name: 'U.A.E Dirham', unit: 1 },
    'MYR': { name: 'Malaysian Ringgit', unit: 1 },
    'KRW': { name: 'South Korean Won', unit: 100 },
    'SEK': { name: 'Swedish Kroner', unit: 1 },
    'DKK': { name: 'Danish Kroner', unit: 1 },
    'HKD': { name: 'Hong Kong Dollar', unit: 1 },
    'KWD': { name: 'Kuwaity Dinar', unit: 1 },
    'BHD': { name: 'Bahrain Dinar', unit: 1 },
    'OMR': { name: 'Omani Rial', unit: 1 }
};
const CURRENCIES = Object.keys(CURRENCY_MAP);
const D1_DATABASE_NAME = "forex-rates"; // !!! CHECK YOUR wrangler.toml / .jsonc !!!

interface WideRateRow {
  date: string;
  [key: string]: any; // All other columns like "USD_buy", "USD_sell"
}

interface LongRateStatement {
  sql: string;
  params: (string | number | null)[];
}

/**
 * Executes a D1 query using wrangler.
 */
async function d1Execute(sql: string): Promise<any> {
  // Use --json flag to get machine-readable output
  const command = `npx wrangler d1 execute ${D1_DATABASE_NAME} --command="${sql}" --json`;
  try {
    const { stdout } = await execPromise(command);
    // The --json flag returns an array of results.
    const result = JSON.parse(stdout);
    return result[0]; // Return the first result object
  } catch (error) {
    console.error(`Error executing D1 command: ${command}`);
    throw error;
  }
}

/**
 * Executes a batch of D1 statements using wrangler.
 */
async function d1Batch(statements: string[]): Promise<void> {
  // wrangler d1 execute --batch requires all commands in one string, separated by newline
  const batchCommand = statements.join('\n');
  const command = `npx wrangler d1 execute ${D1_DATABASE_NAME} --batch`;
  
  try {
    // Pipe the batch commands to stdin
    const child = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Batch exec error: ${error.message}`);
        console.error(`Stderr: ${stderr}`);
        throw error;
      }
      if (stderr) {
         console.warn(`D1 Batch Stderr: ${stderr}`);
      }
      // console.log(`Batch stdout: ${stdout}`);
    });

    child.stdin!.write(batchCommand);
    child.stdin!.end();
    
    // Wait for the child process to exit
    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code === 0) {
          resolve(true);
        } else {
          reject(new Error(`Batch process exited with code ${code}`));
        }
      });
    });

  } catch (error) {
    console.error(`Error executing D1 batch command.`);
    throw error;
  }
}


/**
 * Main backfill function
 */
async function backfillHistoricalTable() {
  console.log("Starting backfill process...");
  
  // 1. Fetch all data from the "wide" forex_rates table
  console.log(`Fetching all rows from 'forex_rates'... This may take a moment.`);
  let allWideRows: WideRateRow[] = [];
  try {
    const result = await d1Execute("SELECT * FROM forex_rates ORDER BY date ASC");
    if (result.success && result.results) {
      allWideRows = result.results;
      console.log(`Successfully fetched ${allWideRows.length} daily records.`);
    } else {
      console.error("Failed to fetch data:", result.meta?.error);
      return;
    }
  } catch (e) {
    console.error("Critical error fetching data:", e);
    return;
  }

  if (allWideRows.length === 0) {
    console.log("No data found in 'forex_rates' table. Nothing to backfill.");
    return;
  }

  // 2. Process rows and generate "long" table statements
  console.log("Generating INSERT statements for 'forex_rates_historical'...");
  let allStatements: string[] = [];
  
  for (const row of allWideRows) {
    const dateStr = row.date;
    
    for (const code of CURRENCIES) {
      const buyRate = row[`${code}_buy`];
      const sellRate = row[`${code}_sell`];
      const currencyInfo = CURRENCY_MAP[code];
      const unit = currencyInfo.unit || 1;

      const perUnitBuy = (buyRate !== null && !isNaN(buyRate)) ? (parseFloat(buyRate) / unit) : null;
      const perUnitSell = (sellRate !== null && !isNaN(sellRate)) ? (parseFloat(sellRate) / unit) : null;
      
      // Only insert if there is valid data
      if (perUnitBuy !== null || perUnitSell !== null) {
        // We must format the SQL string for batch execution
        const buyVal = perUnitBuy === null ? 'NULL' : perUnitBuy;
        const sellVal = perUnitSell === null ? 'NULL' : perUnitSell;
        
        // Use INSERT OR IGNORE to be safe
        const sql = `INSERT OR IGNORE INTO forex_rates_historical (date, currency_code, buy_rate, sell_rate) VALUES ('${dateStr}', '${code}', ${buyVal}, ${sellVal});`;
        allStatements.push(sql);
      }
    }
  }

  console.log(`Generated ${allStatements.length} statements to insert.`);
  if (allStatements.length === 0) {
    console.log("No statements generated. Exiting.");
    return;
  }

  // 3. Execute statements in batches
  const BATCH_SIZE = 400; // D1 has limits on batch size, 400 is safe.
  let totalProcessed = 0;
  
  console.log(`Executing in batches of ${BATCH_SIZE}...`);
  
  for (let i = 0; i < allStatements.length; i += BATCH_SIZE) {
    const batch = allStatements.slice(i, i + BATCH_SIZE);
    try {
      await d1Batch(batch);
      totalProcessed += batch.length;
      console.log(`Processed ${totalProcessed} / ${allStatements.length} statements...`);
    } catch (e) {
      console.error(`Error processing batch ${i / BATCH_SIZE + 1}:`, e);
      console.log("Stopping process due to error.");
      return;
    }
  }

  console.log("-----------------------------------------");
  console.log("✅ Backfill Complete!");
  console.log(`Successfully processed ${totalProcessed} records.`);
  console.log("Your 'forex_rates_historical' table is now populated.");
  console.log("The ArchiveDetail page stats will now be fast and functional.");
  console.log("-----------------------------------------");
}

// Run the backfill
backfillHistoricalTable().catch(e => {
  console.error("Backfill failed:", e);
  process.exit(1);
});
