"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(m, k)) __createBinding(result, m, k);
    __setModuleDefault(result, m);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = __importStar(require("crypto"));

const MINING_REWARD = 50; // Reward for mining a block
const TRANSACTION_FEE = 2;  // Fee paid to miners for processing the transaction

// Transaction class
class Transaction {
    constructor(amount, payer, payee, fee = TRANSACTION_FEE) {
        this.amount = amount;
        this.payer = payer;
        this.payee = payee;
        this.fee = fee;
        this.timestamp = Date.now();
    }

    // Serialise transaction as a string
    toString() {
        return JSON.stringify(this);
    }
}

// Block class
class Block {
    constructor(prevHash, transaction, ts = Date.now()) {
        this.prevHash = prevHash;
        this.transaction = transaction;
        this.ts = ts;
        this.numOnlyUsedOnce = Math.round(Math.random() * 999999999);
        this.minerReward = MINING_REWARD;
    }

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
    constructor() {
        this.chain = [new Block('', new Transaction(100, 'genesis', 'godwin'))];
        this.difficulty = 4; // Adjustable difficulty level
        this.pendingTransactions = [];
        this.miningReward = MINING_REWARD;
        this.balances = {};  // Track wallet balances
    }

    // Return the last block in the chain
    get lastBlock() {
        return this.chain[this.chain.length - 1];
    }

    // Adjust mining difficulty to control how hard it is to mine a block
    adjustDifficulty() {
        if (this.chain.length % 5 === 0) {
            this.difficulty += 1; // Increment difficulty every 5 blocks
        }
    }

    // Mine a block to confirm it as a transaction on the blockchain
    mine(minerPublicKey) {
        let solution = 1;
        console.log('⛏️ Mining block...');
        while (true) {
            const hash = crypto.createHash('MD5');
            hash.update((this.pendingTransactions.length + solution).toString()).end();
            const attempt = hash.digest('hex');
            if (attempt.substr(0, this.difficulty) === '0'.repeat(this.difficulty)) {
                console.log(`Solved transaction with solution: ${solution}. Block is confirmed!`);
                this.adjustDifficulty();
                this.balances[minerPublicKey] = (this.balances[minerPublicKey] || 0) + MINING_REWARD;
                return solution;
            }
            solution += 1;
        }
    }

    // Add a transaction to the pool
    addTransaction(transaction) {
        console.log("📤 Adding Transaction to Pool...");
        this.pendingTransactions.push(transaction);
    }

    // Process all pending transactions
    processTransactions(minerPublicKey) {
        if (this.pendingTransactions.length === 0) {
            console.log("❌ No transactions to process.");
            return;
        }

        const newBlock = new Block(this.lastBlock.hash, this.pendingTransactions);
        this.mine(minerPublicKey);
        this.chain.push(newBlock);
        this.pendingTransactions = []; // Clear the pool after mining
    }

    // Add a block to the blockchain
    addBlock(transaction, senderPublicKey, signature, minerPublicKey) {
        console.log("📤 Processing Transaction...");
        const verifier = crypto.createVerify('SHA256');
        verifier.update(transaction.toString());
        const isValid = verifier.verify(senderPublicKey, signature);
        
        if (isValid) {
            console.log("✅ Transaction is valid!");
            if (!this.balances[senderPublicKey] || this.balances[senderPublicKey] < transaction.amount + transaction.fee) {
                console.log("❌ Insufficient balance for transaction.");
                return;
            }

            // Deduct amount and fee from sender's balance
            this.balances[senderPublicKey] -= (transaction.amount + transaction.fee);
            // Add the amount to the payee's balance
            this.balances[transaction.payee] = (this.balances[transaction.payee] || 0) + transaction.amount;

            this.addTransaction(transaction); // Add transaction to the pool
            this.processTransactions(minerPublicKey); // Process the transactions
        }
    }

    // Check the balance of a specific public key
    checkBalance(publicKey) {
        return this.balances[publicKey] || 0;
    }
}

// Singleton instance as we only want 1 chain ..
Chain.instance = new Chain();

// Wallet class
class Wallet {
    // Generate key pair when a new wallet is created
    constructor() {
        const keypair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });
        this.privateKey = keypair.privateKey;
        this.publicKey = keypair.publicKey;
        Chain.instance.balances[this.publicKey] = 100; // Starting balance for new wallets
    }

    // Send money from user's wallet to another
    sendMoney(amount, payeePublicKey) {
        const transaction = new Transaction(amount, this.publicKey, payeePublicKey);
        const sign = crypto.createSign('SHA256');
        sign.update(transaction.toString()).end();
        const signature = sign.sign(this.privateKey);
        Chain.instance.addBlock(transaction, this.publicKey, signature, this.publicKey);
    }

    // Check wallet balance
    get balance() {
        return Chain.instance.checkBalance(this.publicKey);
    }
}

// Usage example
const miner = new Wallet();  // Miner wallet
const alice = new Wallet();
const bob = new Wallet();

alice.sendMoney(50, bob.publicKey);  // Alice sends money to Bob
bob.sendMoney(20, alice.publicKey);  // Bob sends money back to Alice
miner.sendMoney(10, alice.publicKey);  // Miner sends money to Alice

console.log("Alice's Balance:", alice.balance);
console.log("Bob's Balance:", bob.balance);
console.log("Miner's Balance:", miner.balance);
console.log(Chain.instance);
