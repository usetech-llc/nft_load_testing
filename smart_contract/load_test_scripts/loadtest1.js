const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { Abi, ContractPromise } = require('@polkadot/api-contract');
const config = require('./config');

var BigNumber = require('bignumber.js');
BigNumber.config({ DECIMAL_PLACES: 12, ROUNDING_MODE: BigNumber.ROUND_DOWN, decimalSeparator: '.' });

const rtt = require("./runtime_types.json");
const contractAbi = require("./metadata.json");

async function getUniqueConnection() {
  // Initialise the provider to connect to the node
  const wsProviderNft = new WsProvider(config.wsEndpointNft);

  // Create the API and wait until ready
  const api = new ApiPromise({ 
    provider: wsProviderNft,
    types: rtt
  });

  api.on('disconnected', async (value) => {
    console.log(`disconnected: ${value}`);
    process.exit();
  });
  api.on('error', async (value) => {
    console.log(`error: ${value.toString()}`);
    process.exit();
  });

  await api.isReady;

  return api;
}

function sendTransactionAsync(sender, transaction) {
  return new Promise(async function(resolve, reject) {

    try {
      const unsub = await transaction
        .signAndSend(sender, ({ events = [], status }) => {
      
        if (status == 'Ready') {
          // nothing to do
          console.log(`Current tx status is Ready`);
        }
        else if (JSON.parse(status).Broadcast) {
          // nothing to do
          console.log(`Current tx status is Broadcast`);
        }
        else if (status.isInBlock) {
          console.log(`Transaction included at blockHash ${status.asInBlock}`);
          // resolve();
          // unsub();
        } else if (status.isFinalized) {
          console.log(`Transaction finalized at blockHash ${status.asFinalized}`);

          // Loop through Vec<EventRecord> to display all events
          let success = false;
          events.forEach(({ phase, event: { data, method, section } }) => {
            console.log(`\t' ${phase}: ${section}.${method}:: ${data}`);
            if (method == 'ExtrinsicSuccess') {
              success = true;
            }
          });

          if (success) resolve();
          else {
            reject();
          }
          unsub();
        }
        else //if (status.isUsurped) 
        {
          console.log(`Something went wrong with transaction. Status: ${status}`);

          reject();
          unsub();
        }
      });
    } catch (e) {
      console.log("Error: ", e);
      reject(e);
    }
  });

}

const value = 0;
const maxgas = 1000000000000;

async function addData(api, sender, number) {

  const abi = new Abi(contractAbi);
  const contract = new ContractPromise(api, abi, config.contractAddress);

  const tx = contract.tx.bloat(value, maxgas, number);

  await sendTransactionAsync(sender, tx);
}

async function readContract(api, sender) {
  const abi = new Abi(contractAbi);
  const contract = new ContractPromise(api, abi, config.contractAddress);

  const vec = await contract.query.get(sender.address, value, maxgas);
  console.log("Vector read. Length: ", vec.output.length);
}


async function main() {

  const api = await getUniqueConnection();
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri("//Alice");

  await addData(api, alice, 100);
  await readContract(api, alice);

  api.disconnect();
}


main().catch(console.error).finally(() => process.exit());
