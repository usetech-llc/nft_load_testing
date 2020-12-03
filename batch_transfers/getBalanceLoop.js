const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const fs = require('fs');

async function main() {
  // Initialise the provider to connect to the node
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  // const wsProvider = new WsProvider('wss://unique.usetech.com');
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

  let count = 0;
  let hrTime = process.hrtime();
  let microsec1 = hrTime[0] * 1000000 + hrTime[1] / 1000;
  let rate = 0;
  const checkPoint = 1000;
  while (true) {
    await api.query.system.account(alice.address);
    count++;
    process.stdout.write(`Read balance ${count} times at rate ${rate} r/s            \r`);

    if (count % checkPoint == 0) {
      hrTime = process.hrtime();
      let microsec2 = hrTime[0] * 1000000 + hrTime[1] / 1000;
      rate = 1000000*checkPoint/(microsec2 - microsec1);
      microsec1 = microsec2;
    }
  }
}

main().catch(console.error).finally(() => process.exit());
