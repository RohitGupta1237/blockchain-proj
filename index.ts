import * as crypto from 'crypto';
import * as net from 'net';
import * as readline from 'readline';
import * as fs from 'fs';

// Constants
const MINING_REWARD = 50; // Reward for mining a block
const TRANSACTION_FEE = 2; // Transaction fee for each transaction
const DIFFICULTY_ADJUSTMENT_INTERVAL = 5; // Interval for difficulty adjustment
const WALLET_BACKUP_FILE = 'walletBackup.json'; // File to store wallet backup

// Transaction class
class Transaction {
    constructor(
        public amount: number,
        public payer: string, // Public key of sender
        public payee: string, // Public key of recipient
        public fee: number = TRANSACTION_FEE, // Fee charged for transaction
        public timestamp: number = Date.now(), // Timestamp for transaction
        public signature?: string // Optional: Signature of transaction
    ) {}

    // Serialize transaction as a string
    toString() {
        return JSON.stringify(this);
    }

    // Sign transaction with private key
    sign(privateKey: string) {
        const sign = crypto.createSign('SHA256');
        sign.update(this.toString()).end();
        this.signature = sign.sign(privateKey, 'hex');
    }

    // Verify transaction signature
    verify() {
        if (!this.signature) return false;
        const verify = crypto.createVerify('SHA256');
        verify.update(this.toString()).end();
        return verify.verify(this.payer, this.signature, 'hex');
    }
}

// Block class
class Block {
    public numOnlyUsedOnce = Math.round(Math.random() * 999999999);

    constructor(
        public prevHash: string,
        public transaction: Transaction,
        public ts = Date.now()
    ) {}

    // Getter method to return a hash of this block
    get hash() {
        const str = JSON.stringify(this);
        const hash = crypto.createHash('SHA256');
        hash.update(str).end();
        return hash.digest('hex');
    }
}

// Chain class
class Chain {
    public static instance = new Chain();
    public chain: Block[];
    public balances: { [key: string]: number } = {};
    public miningReward = MINING_REWARD;
    public difficulty = 4; // Adjustable difficulty level
    private pendingTransactions: Transaction[] = [];
    private lastAdjustmentTime = Date.now();

    constructor() {
        this.chain = [new Block('', new Transaction(100, 'genesis', 'godwin'))];
    }

    get lastBlock() {
        return this.chain[this.chain.length - 1];
    }

    mine(minerPublicKey: string) {
        let solution = 1;
        console.log('⛏️ Mining transaction...');

        while (true) {
            const hash = crypto.createHash('MD5');
            hash.update((this.lastBlock.numOnlyUsedOnce + solution).toString()).end();
            const attempt = hash.digest('hex');

            if (attempt.substr(0, this.difficulty) === '0'.repeat(this.difficulty)) {
                console.log(`✔️ Solved transaction with solution: ${solution}. Block is confirmed!\n`);
                this.balances[minerPublicKey] = (this.balances[minerPublicKey] || 0) + MINING_REWARD;
                return solution;
            }

            solution += 1;
        }
    }

    addTransaction(transaction: Transaction) {
        // Validate transaction
        if (!transaction.verify()) {
            console.log("❌ Invalid transaction signature.");
            return false;
        }

        if (!this.balances[transaction.payer] || this.balances[transaction.payer] < (transaction.amount + transaction.fee)) {
            console.log("❌ Insufficient balance for transaction.");
            return false;
        }

        // Deduct amount and fee from sender's balance
        this.balances[transaction.payer] -= (transaction.amount + transaction.fee);
        // Add amount to payee's balance
        this.balances[transaction.payee] = (this.balances[transaction.payee] || 0) + transaction.amount;

        // Add to pending transactions
        this.pendingTransactions.push(transaction);
        return true;
    }

    processPendingTransactions(minerPublicKey: string) {
        if (this.pendingTransactions.length === 0) {
            console.log("No transactions to mine.");
            return;
        }

        const newBlock = new Block(this.lastBlock.hash, this.pendingTransactions[0]);
        this.mine(minerPublicKey);
        this.chain.push(newBlock);
        this.pendingTransactions = []; // Clear pending transactions
    }

    getBalance(publicKey: string) {
        return this.balances[publicKey] || 0;
    }

    getChain() {
        return this.chain;
    }

    adjustDifficulty() {
        const now = Date.now();
        const timeTaken = now - this.lastAdjustmentTime;
        const timePerBlock = timeTaken / this.chain.length;

        if (this.chain.length % DIFFICULTY_ADJUSTMENT_INTERVAL === 0 && timePerBlock > 10000) {
            this.difficulty += 1; // Increase difficulty if block time is too high
            console.log("Increasing difficulty.");
        }
        this.lastAdjustmentTime = now;
    }
}

// Wallet class
class Wallet {
    public publicKey: string;
    public privateKey: string;

    constructor() {
        const keypair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        this.privateKey = keypair.privateKey;
        this.publicKey = keypair.publicKey;
        Chain.instance.balances[this.publicKey] = 100; // Starting balance
    }

    sendMoney(amount: number, payeePublicKey: string) {
        const transaction = new Transaction(amount, this.publicKey, payeePublicKey);
        transaction.sign(this.privateKey);

        // Add transaction to the chain
        if (Chain.instance.addTransaction(transaction)) {
            Chain.instance.processPendingTransactions(this.publicKey);
        }
    }

    getBalance() {
        return Chain.instance.getBalance(this.publicKey);
    }

    getTransactionHistory() {
        return Chain.instance.getChain();
    }

    backupWallet() {
        const backupData = {
            publicKey: this.publicKey,
            privateKey: this.privateKey,
        };
        fs.writeFileSync(WALLET_BACKUP_FILE, JSON.stringify(backupData));
        console.log("Wallet backed up successfully.");
    }

    static restoreWallet() {
        const backupData = fs.readFileSync(WALLET_BACKUP_FILE, 'utf-8');
        const { publicKey, privateKey } = JSON.parse(backupData);
        const restoredWallet = new Wallet();
        restoredWallet.publicKey = publicKey;
        restoredWallet.privateKey = privateKey;
        return restoredWallet;
    }
}

// Peer-to-Peer Network
class Peer {
    private server: net.Server;
    private port: number;
    private peers: Set<string>;

    constructor(port: number) {
        this.port = port;
        this.peers = new Set();
        this.server = net.createServer(this.handleConnection.bind(this));
        this.server.listen(this.port, () => {
            console.log(`Peer server listening on port ${this.port}`);
        });
    }

    handleConnection(socket: net.Socket) {
        socket.on('data', (data) => {
            const message = JSON.parse(data.toString());
            console.log(`Received message: ${JSON.stringify(message)}`);
            // Handle different message types
        });
    }

    connectToPeer(host: string, port: number) {
        const socket = net.connect(port, host, () => {
            console.log(`Connected to peer at ${host}:${port}`);
            this.peers.add(`${host}:${port}`);
        });

        socket.on('data', (data) => {
            const message = JSON.parse(data.toString());
            console.log(`Received message from peer: ${JSON.stringify(message)}`);
        });
    }
}

// Command Line Interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const miner = new Wallet();
const alice = new Wallet();
const bob = new Wallet();

// Start the peer server
const peerPort = 3000; // Change this port as needed
const peer = new Peer(peerPort);

// Connect to peers (for demonstration)
peer.connectToPeer('localhost', 3001);

// Command-line interaction
function promptUser() {
    rl.question('Enter command (send [amount] [recipient] / balance / history / backup / restore / exit): ', (input) => {
        const args = input.split(' ');

        if (args[0] === 'send') {
            const amount = parseFloat(args[1]);
            const recipient = args[2];
            miner.sendMoney(amount, recipient);
        } else if (args[0] === 'balance') {
            console.log(`Miner's Balance: ${miner.getBalance()}`);
            console.log(`Alice's Balance: ${alice.getBalance()}`);
            console.log(`Bob's Balance: ${bob.getBalance()}`);
        } else if (args[0] === 'history') {
            console.log("Blockchain Transaction History:", miner.getTransactionHistory());
        } else if (args[0] === 'backup') {
            miner.backupWallet();
        } else if (args[0] === 'restore') {
            const restoredWallet = Wallet.restoreWallet();
            console.log("Wallet restored:", restoredWallet.publicKey);
        } else if (args[0] === 'exit') {
            rl.close();
            process.exit(0);
        } else {
            console.log("Unknown command. Please try again.");
        }

        promptUser(); // Prompt again
    });
}

// Start prompting for user input
promptUser();
