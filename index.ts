import * as crypto from 'crypto';

// Constants
const MINING_REWARD = 50;  // Reward for mining a block
const TRANSACTION_FEE = 2; // Transaction fee for each transaction

// Transaction class
class Transaction {

    constructor(
        public amount: number,
        public payer: string,      // Public key of sender
        public payee: string,      // Public key of recipient
        public fee: number = TRANSACTION_FEE // Fee charged for transaction
    ) {}

    // Serialize transaction as a string
    toString() {
        return JSON.stringify(this);
    }
}

// Block class
class Block {

    // Number only used once, used as the solution for mining
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

    // Singleton instance as we only want 1 chain
    public static instance = new Chain();

    // The chain is a series of linked blocks
    chain: Block[];

    // Track balances for wallets
    balances: { [key: string]: number } = {};

    // Mining reward and transaction fee
    miningReward = MINING_REWARD;

    // Difficulty level for mining (more zeros at the beginning of hash)
    difficulty = 4;

    // Create genesis block
    constructor() {
        this.chain = [new Block('', new Transaction(100, 'genesis', 'godwin'))];
    }

    // Return the last block in the chain
    get lastBlock() {
        return this.chain[this.chain.length - 1];
    }

    // Mine a block to confirm it as a transaction on the blockchain
    mine(numOnlyUsedOnce: number, minerPublicKey: string) {
        let solution = 1;
        console.log('⛏️ Mining transaction...');

        while (true) {
            const hash = crypto.createHash('MD5');
            hash.update((numOnlyUsedOnce + solution).toString()).end();

            const attempt = hash.digest('hex');

            // Add more 0's to make it harder
            if (attempt.substr(0, this.difficulty) === '0'.repeat(this.difficulty)) {
                console.log(`✔️ Solved transaction with solution: ${solution}. Block is confirmed!\n`);
                this.balances[minerPublicKey] = (this.balances[minerPublicKey] || 0) + MINING_REWARD;
                return solution;
            }

            solution += 1;
        }
    }

    // Add a block to the blockchain
    addBlock(transaction: Transaction, senderPublicKey: string, signature: Buffer, minerPublicKey: string) {

        console.log("📤 Processing transaction...");

        // Verify a transaction before adding it
        const verifier = crypto.createVerify('SHA256');
        verifier.update(transaction.toString());

        const isValid = verifier.verify(senderPublicKey, signature);

        if (isValid) {
            console.log("✅ Transaction is valid!");

            // Check if sender has enough balance
            if (!this.balances[senderPublicKey] || this.balances[senderPublicKey] < (transaction.amount + transaction.fee)) {
                console.log("❌ Insufficient balance for transaction.");
                return;
            }

            // Deduct amount and fee from sender's balance
            this.balances[senderPublicKey] -= (transaction.amount + transaction.fee);
            // Add amount to payee's balance
            this.balances[transaction.payee] = (this.balances[transaction.payee] || 0) + transaction.amount;

            // Create a new block
            const newBlock = new Block(this.lastBlock.hash, transaction);
            this.mine(newBlock.numOnlyUsedOnce, minerPublicKey);
            this.chain.push(newBlock);

            // Miner receives the transaction fee
            this.balances[minerPublicKey] = (this.balances[minerPublicKey] || 0) + transaction.fee;
        }
    }

    // Check balance for a specific public key
    getBalance(publicKey: string) {
        return this.balances[publicKey] || 0;
    }

    // View the entire chain (for displaying transaction history)
    getChain() {
        return this.chain;
    }

    // Adjust mining difficulty over time
    adjustDifficulty() {
        if (this.chain.length % 5 === 0) {
            this.difficulty += 1;
        }
    }
}

// Wallet class
class Wallet {

    public publicKey: string;
    public privateKey: string;

    // Generate key pair when a new wallet is created
    constructor() {
        const keypair = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        });

        this.privateKey = keypair.privateKey;
        this.publicKey = keypair.publicKey;

        // Assign an initial balance for new wallets
        Chain.instance.balances[this.publicKey] = 100; // Default starting balance
    }

    // Send money from users wallet to another
    sendMoney(amount: number, payeePublicKey: string) {
        const transaction = new Transaction(amount, this.publicKey, payeePublicKey);

        const sign = crypto.createSign('SHA256');
        sign.update(transaction.toString()).end();

        const signature = sign.sign(this.privateKey);
        Chain.instance.addBlock(transaction, this.publicKey, signature, this.publicKey);
    }

    // Check wallet balance
    getBalance() {
        return Chain.instance.getBalance(this.publicKey);
    }

    // View transaction history
    getTransactionHistory() {
        return Chain.instance.getChain();
    }
}

// Test the system
const miner = new Wallet();
const alice = new Wallet();
const bob = new Wallet();

alice.sendMoney(50, bob.publicKey);  // Alice sends money to Bob
bob.sendMoney(20, alice.publicKey);  // Bob sends money back to Alice

console.log("Alice's Balance:", alice.getBalance());
console.log("Bob's Balance:", bob.getBalance());
console.log("Miner's Balance:", miner.getBalance());

// View the entire chain (transaction history)
console.log("Blockchain Transaction History:", miner.getTransactionHistory());
