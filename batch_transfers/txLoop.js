const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { default: BigNumber } = require('bignumber.js');
const fs = require('fs');

const TRANSACTIONS_PER_BLOCK = 1000;

function sendTransactionAsync(sender, transaction) {
  return new Promise(async function(resolve, reject) {
    try {
      const unsub = await transaction
        .signAndSend(sender, ({ events = [], status }) => {
      
        if (status == 'Ready') {
          // nothing to do
        }
        else if (status == 'Invalid') {
          resolve(false);
          unsub();
        }
        else if (JSON.parse(status).Broadcast) {
          // nothing to do
        }
        else if (status.isInBlock) {
          resolve(true);
          unsub();
        } else if (status.isFinalized) {
          resolve(true);
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
    jobs.push(sendTransactionAsync(batch[i].sender, tx));

    // console.log(`${batch[i].sender.address} transferring ${batch[i].amount} to ${batch[i].address}`);
  }

  const result = await Promise.all(jobs);
  let success = 0;
  for (let i=0; i<result.length; i++) {
    success++;
  }
  return success;
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
  let amount = new BigNumber('1000000000000000000');
  let batchAmount = amount.multipliedBy(TRANSACTIONS_PER_BLOCK);

  // Alice -> Sender 1
  process.stdout.write(`Crediting senders ...            \r`);
  const tx = api.tx.balances.transfer(alice.address, batchAmount);
  await sendTransactionAsync(alice, tx);

  let i=1;
  while (i<TRANSACTIONS_PER_BLOCK) {
    batchAmount = batchAmount.dividedBy(2).integerValue();

    // Senders share. Senders 0..i already have balance and share it with next i
    let batch = [];
    for (let j=0; j<i; j++) {
      if (i+j < TRANSACTIONS_PER_BLOCK) {
        batch.push({
          sender: senders[j],
          address: senders[i+j].address,
          amount: batchAmount
        });
      }
    }

    const success = await batchTransfer(api, batch);
    if (success != i) {
      console.log(`WARNING: Only ${success} of ${i} txs were successful`);
    }

    i *= 2;
    if (i > TRANSACTIONS_PER_BLOCK) i = TRANSACTIONS_PER_BLOCK;

    process.stdout.write(`Crediting senders ... ${i} of ${TRANSACTIONS_PER_BLOCK}           \r`);
  }
  console.log(`Crediting senders ... done                        `);

  /////////////////////////////////////////////////////////////////////////
  // Send TRANSACTIONS_PER_BLOCK in each block

  process.stdout.write(`Sending transactions ...            \r`);
  let count = 0;
  while (true) {
    let batch = [];
    for (let i=0; i<TRANSACTIONS_PER_BLOCK; i++) {
      batch.push({
        sender: senders[i],
        address: alice.address,
        amount: 1
      });
    }

    await batchTransfer(api, batch);
    count += TRANSACTIONS_PER_BLOCK;
    process.stdout.write(`Sending transactions ... ${count}           \r`);
  }
}

main().catch(console.error).finally(() => process.exit());
