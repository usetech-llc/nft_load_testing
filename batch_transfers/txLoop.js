const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const fs = require('fs');

const TRANSACTIONS_PER_BLOCK = 1000;

function sendTransactionAsync(api, sender, transaction) {
  return new Promise(async function(resolve, reject) {
    try {
      const unsub = await transaction
        .signAndSend(sender, ({ events = [], status }) => {
      
        if (status == 'Ready') {
          // nothing to do
          // console.log(`Current tx status is Ready`);
        }
        else if (JSON.parse(status).Broadcast) {
          // nothing to do
          // console.log(`Current tx status is Broadcast`);
        }
        else if (status.isInBlock) {
          // console.log(`Transaction included at blockHash ${status.asInBlock}`);
          resolve();
          unsub();

        } else if (status.isFinalized) {
          // console.log(`Transaction finalized at blockHash ${status.asFinalized}`);

          // // Loop through Vec<EventRecord> to display all events
          // let success = false;
          // events.forEach(({ phase, event: { data, method, section } }) => {
          //   // console.log(`    ${phase}: ${section}.${method}:: ${data}`);
          //   if (method == 'ExtrinsicSuccess') {
          //     success = true;
          //   }
          // });

          // if (success) resolve();
          // else {
          //   reject("Transaction failed");
          // }
          resolve();
          unsub();
        }
        else
        {
          console.log(`Something went wrong with transaction. Status: ${status}`);

          reject("Transaction failed");
          unsub();
        }
      });
    } catch (e) {
      console.log("Error: ", e);
      reject(e);
    }
  });
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

  /////////////////////////////////////////////////////////////////////////
  // Generate TRANSACTIONS_PER_BLOCK addresses
  let senders = [];
  process.stdout.write(`Generating sender addresses ...            \r`);
  for (let i=0; i<TRANSACTIONS_PER_BLOCK; i++) {
    const sender = keyring.addFromUri(`//Sender${i}`);
    senders.push(sender);

    process.stdout.write(`Generating sender addresses ... ${i} of ${TRANSACTIONS_PER_BLOCK}           \r`);

  }
  console.log(`Generating sender addresses ... done                        `);

  /////////////////////////////////////////////////////////////////////////
  // Transfer 1000 to each address
  process.stdout.write(`Crediting senders ...            \r`);
  for (let i=0; i<TRANSACTIONS_PER_BLOCK; i++) {
    const bal = (await api.query.system.account(senders[i].address)).data.free;
    // console.log(bal.toString());
    if (bal < 1e17) {
      const tx = api.tx.balances.transfer(senders[i].address, '1000000000000000000');
      await sendTransactionAsync(api, alice, tx);
    }

    process.stdout.write(`Crediting senders ... ${i} of ${TRANSACTIONS_PER_BLOCK}           \r`);
  }
  console.log(`Crediting senders ... done                        `);

  /////////////////////////////////////////////////////////////////////////
  // Send TRANSACTIONS_PER_BLOCK in each block

  process.stdout.write(`Sending transactions ...            \r`);
  let count = 0;
  while (true) {
    let jobs = [];

    for (let i=0; i<TRANSACTIONS_PER_BLOCK; i++) {
      const tx = api.tx.balances.transfer(alice.address, 1);
      jobs.push(sendTransactionAsync(api, senders[i], tx));
    }

    await Promise.all(jobs);
    count += TRANSACTIONS_PER_BLOCK;
    process.stdout.write(`Sending transactions ... ${count}           \r`);
  }
}

main().catch(console.error).finally(() => process.exit());
