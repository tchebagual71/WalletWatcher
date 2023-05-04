const dotenv = require('dotenv');

const { Network, Alchemy, Utils } = require('alchemy-sdk');

const settings = {
    apiKey: process.env.ALCHEMY_KEY,
    network: Network.ETH_MAINNET,
};

const { Client, Events, GatewayIntentBits } = require('discord.js');

dotenv.config();

const client = new Client({
    intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
    ]
});

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(BOT_TOKEN).catch((error) => {
    console.error('Failed to log in:', error.message);
    process.exit(1);
});

const alchemy = new Alchemy(settings);

let trackedAddress = '';

alchemy.core
    .getTokenBalances('0x994b342dd87fc825f66e51ffa3ef71ad818b6893')
    .then(console.log);

const nfts = alchemy.nft.getNftsForOwner("0x994b342dd87fc825f66e51ffa3ef71ad818b6893");


async function monitorBlockchain() {
    try {
        let lastBlockNumber = await alchemy.core.getBlockNumber();

        setInterval(async () => {
            try {
                const currentBlockNumber = await alchemy.core.getBlockNumber();

                // Send a message to the channel indicating the bot is checking for transactions
                if (trackedAddress) {
                    client.channels.cache.get(CHANNEL_ID).send(`👀 Watching address: ${shortenAddress(trackedAddress)}`);                }

                for (let i = lastBlockNumber + 1; i <= currentBlockNumber; i++) {
                    const block = await alchemy.core.getBlockWithTransactions(i);

                    for (const transaction of block.transactions) {
                        if (transaction.to && transaction.to.toLowerCase() === trackedAddress) {
                            // Sending transaction found
                            client.channels.cache.get(CHANNEL_ID).send(`💰 Transaction received: ${Utils.formatEther(transaction.value)} ETH\nFrom: ${shortenAddress(transaction.from)}\nTo: ${shortenAddress(transaction.to)}`);
                        } else if (transaction.from && transaction.from.toLowerCase() === trackedAddress) {
                            // Receiving transaction found
                            client.channels.cache.get(CHANNEL_ID).send(`💸 Transaction sent: ${Utils.formatEther(transaction.value)} ETH\nFrom: ${shortenAddress(transaction.from)}\nTo: ${shortenAddress(transaction.to)}`);
                        }
                    }
                }

                lastBlockNumber = currentBlockNumber;
            } catch (error) {
                console.error('❌ Error while monitoring blockchain:', error.message);
            }
        }, 30000); // Check for new blocks every 30 seconds
    } catch (error) {
        console.error('❌ Error while initializing monitorBlockchain:', error.message);
    }
}

client.on('ready', () => {
    console.log('Connected to Discord and ready!');
    console.log('Bot is running as:', client.user.tag);
    console.log(`Monitoring channel ID: ${CHANNEL_ID}`);

    // Send a greeting message to the channel
    client.channels.cache.get(CHANNEL_ID).send(`🤖 ${client.user.tag}  WalletWatcher is online!`);
    const greetingMessage = '🎉 Sup bitches. I\'m here to help you track Ethereum wallets and NFTs. Type `!help` to see the available commands.';
    client.channels.cache.get(CHANNEL_ID).send(greetingMessage);

    monitorBlockchain();
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const args = message.content.trim().split(/ +/g);
    const command = args.shift().toLowerCase();

    if (command === '!track') {
        const address = args[0];
        trackedAddress = address.toLowerCase();
        message.channel.send(`🔎 Now tracking address: ${trackedAddress}`);
        console.log(`Tracking address: ${trackedAddress}`);
    } else if (command === '!balance') {
        const address = args[0];
        if (!address) {
            message.channel.send('❗ Please provide an Ethereum address. Example: `!balance 0x742d35Cc6634C0532925a3b844Bc454e4438f44e`');
            return;
        }
        try {
            const balance = await alchemy.core.getBalance(address, "latest");
            message.channel.send(`💰 Balance for address ${shortenAddress(address)}: ${Utils.formatEther(balance)} ETH`);
        } catch (error) {
            console.error('Error getting balance:', error.message);
            message.channel.send('❌ Error: Could not fetch the balance. Please make sure the Ethereum address is correct.');
        }
    } else if (command === '!nfts') {
        const address = args[0];
        if (!address) {
            message.channel.send('❗ Please provide an Ethereum address. Example: `!nfts 0x742d35Cc6634C0532925a3b844Bc454e4438f44e`');
            return;
        }
        try {
            const nfts = await alchemy.nft.getNftsForOwner(address);
            if (nfts.length === 0) {
                message.channel.send(`🎨 No NFTs found for address ${shortenAddress(address)}`);
            } else {
                let nftMessage = `🎨 NFTs for address ${shortenAddress(address)}:\n`;
                for (const nft of nfts) {
                    nftMessage += `- ${nft.name} (Token ID: ${nft.token_id})\n`;
                }
                message.channel.send(nftMessage);
            }
        } catch (error) {
            console.error('Error getting NFTs:', error.message);
            message.channel.send('❌ Error: Could not fetch NFTs. Please make sure the Ethereum address is correct.');
        }
    } else if (command === '!help') {
        const helpMessage = `
📚 **Available Commands:**
\`\`\`
!track <address>   - Track an Ethereum address for incoming and outgoing transactions
!balance <address> - Check the Ether balance of an Ethereum address
!nfts <address>    - List NFTs owned by an Ethereum address
!help              - Show this help message
\`\`\`
`;
        message.channel.send(helpMessage);
    }
});

function shortenAddress(address) {
    if (!address) return '';
    return address.slice(0, 6) + '...' + address.slice(-4);
}
