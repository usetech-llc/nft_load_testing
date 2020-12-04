const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { default: BigNumber } = require('bignumber.js');
const fs = require('fs');
const delay = require('delay');

const PARALLEL_TRANSACTIONS = 4096;
let successCount = 0;
let failureCount = 0;

function sendTransactionAsync(sender, transaction, waitFinality) {
  return new Promise(async function(resolve, reject) {
    try {
      const unsub = await transaction
        .signAndSend(sender, ({ events = [], status }) => {
      
        if (status == 'Ready') {
          // resolve(true);
          // unsub();
        }
        else if (status == 'Invalid') {
          resolve(false);
          unsub();
        }
        else if (JSON.parse(status).Broadcast) {
          // resolve(true);
          // unsub();
        }
        else if (status.isInBlock) {
          if (!waitFinality) {
            resolve(true);
            unsub();
          }
        } else if (status.isFinalized) {
          // Loop through Vec<EventRecord> to display all events
          let success = false;
          events.forEach(({ phase, event: { data, method, section } }) => {
            if (method == 'ExtrinsicSuccess') {
              success = true;
            }
          });

          resolve(success);
          unsub();
        }
        else
        {
          // console.log(`Something went wrong with transaction. Status: ${status}`);
          resolve(false);
          unsub();
        }
      });
    } catch (e) {
      // console.log("Error: ", e);
      resolve(false);
    }
  });
}

async function batchTransfer(api, batch) {
  let jobs = [];

  for (let i=0; i<batch.length; i++) {
    const tx = api.tx.balances.transfer(batch[i].address, batch[i].amount);
    jobs.push(sendTransactionAsync(batch[i].sender, tx, false));

    // console.log(`${batch[i].sender.address} transferring ${batch[i].amount} to ${batch[i].address}`);
  }

  const result = await Promise.all(jobs);
  let success = 0;
  for (let i=0; i<result.length; i++) {
    success++;
  }
  return success;
}

async function infiniteTransactions(api, sender, recipient, amount) {
  while (true) {
    const tx = api.tx.balances.transfer(recipient, amount);
    if (await sendTransactionAsync(sender, tx, true))
      successCount++;
    else
      failureCount++;
  }
}

async function update() {

  let hrTime = process.hrtime();
  let microsec1 = hrTime[0] * 1000000 + hrTime[1] / 1000;
  let rate = 0;

  while (true) {
    hrTime = process.hrtime();
    let microsec2 = hrTime[0] * 1000000 + hrTime[1] / 1000;
    rate = 1000000*successCount/(microsec2 - microsec1);

    process.stdout.write(`Sending transactions ... ${successCount} successful, ${failureCount} failed, TPS: ${rate}             \r`);
    await delay(1000);
  }
}

async function main() {
  // Initialise the provider to connect to the node
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const rtt = JSON.parse(fs.readFileSync("runtime_types_dev.json"));

  // Create the API and wait until ready
  const api = await ApiPromise.create({ 
    provider: wsProvider,
    types: rtt
  });

  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri("//Alice");
  let bal = (await api.query.system.account(alice.address)).data.free;
  console.log("Alice's balance = ", bal.toString());
  
  // let bal2 = (await api.query.system.account("5H952UHXwEf9SfwVmPkLNozbkGss14GtdUd9NFUgNMV8Rh99")).data.free;
  // console.log("Sender 1 balance = ", bal2.toString());

  /////////////////////////////////////////////////////////////////////////
  // Generate PARALLEL_TRANSACTIONS addresses
  let senders = [];
  process.stdout.write(`Generating sender addresses ...            \r`);
  for (let i=0; i<PARALLEL_TRANSACTIONS; i++) {
    const sender = keyring.addFromUri(`//Sender${i}`);
    senders.push(sender);

    process.stdout.write(`Generating sender addresses ... ${i} of ${PARALLEL_TRANSACTIONS}           \r`);

  }
  console.log(`Generating sender addresses ... done                        `);

  /////////////////////////////////////////////////////////////////////////
  // Transfer 1000 to each address
  let amount = new BigNumber('1000000000000000000');
  let batchAmount = amount.multipliedBy(PARALLEL_TRANSACTIONS);
  console.log(`Starting amount: ${batchAmount.toFixed()}`);

  // Alice -> Sender 1
  process.stdout.write(`Crediting senders ...            \r`);
  const tx = api.tx.balances.transfer(senders[0].address, batchAmount.toFixed());
  await sendTransactionAsync(alice, tx, false);

  let i=1;
  while (i<PARALLEL_TRANSACTIONS) {
    batchAmount = batchAmount.dividedBy(2).integerValue();

    // Senders share. Senders 0..i already have balance and share it with next i
    let batch = [];
    for (let j=0; j<i; j++) {
      if (i+j < PARALLEL_TRANSACTIONS) {
        batch.push({
          sender: senders[j],
          address: senders[i+j].address,
          amount: batchAmount.toFixed()
        });
      }
    }

    const success = await batchTransfer(api, batch);
    // if (success != i) {
    //   console.log(`WARNING: Only ${success} of ${i} txs were successful                         `);
    // }

    i *= 2;
    if (i > PARALLEL_TRANSACTIONS) i = PARALLEL_TRANSACTIONS;

    process.stdout.write(`Crediting senders ... ${i} of ${PARALLEL_TRANSACTIONS}           \r`);
  }
  console.log(`Crediting senders ... done                        `);

  /////////////////////////////////////////////////////////////////////////
  // Start PARALLEL_TRANSACTIONS tasks

  process.stdout.write(`Sending transactions ...            \r`);

  let jobs = [update()];
  for (let i=0; i<PARALLEL_TRANSACTIONS; i++) {
    jobs.push(infiniteTransactions(api, senders[i], alice.address, 1));
  }
  await Promise.all(jobs);

}

main().catch(console.error).finally(() => process.exit());
