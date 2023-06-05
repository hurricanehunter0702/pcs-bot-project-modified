/**
 * The module: BetStrategy exposes the functions that execute the logics for managing the interactions with the smart contract. It calls the functions that interact with it and handle the returned transactions.
 * @Module 
 * @author luca.musarella
 */
const { ethers } = require("ethers");
const { GLOBAL_CONFIG } = require("../../bot-configuration/bot-configuration");
const { BET_DOWN, BET_UP } = require("../common/constants/bot.constants");
const { parseFromUsdToCrypto, formatUnit, parseFeeFromCryptoToUsd, getBetAmount } = require("../common/utils.module");
const { saveRoundInHistory } = require("../history/history.module");
const { betUp, betDown, isClaimableRound, claimRewards } = require("../smart-contracts/pcs-prediction-smart-contract.module");
const { getSimulationBalance, updateSimulationBalance } = require("../wallet/wallet.module");
const { getRoundData, getMinBetAmount, getCurrentEpoch, setSmartContratConfig } = require('../smart-contracts/pcs-prediction-smart-contract.module');

/**
 * Converts the bet amount from dollars to crypto, calls the function to place the bet down and saves the transaction data. In case of simulated mode, it updates the fictitious balance
 * @date 4/22/2023 - 3:57:23 PM
 *
 * @async
 * @param {ethers.BigNumber} epoch - round
 * @returns {Boolean} - flag indicating the execution of the transaction
 */
let loseCount = 0;
let winCount = 0;
let roundNumber = 0;
let betResult = '';
let normalBetAmount = getBetAmount();
let betAmount = 0;
let martingaleBetAmount = 0;
const betDownStrategy = async (epoch) => {
    let transaction;
    let prevRoundData = await getRoundData(epoch - 1);
    if (roundNumber > 7) {
        winCount = 0;
        roundNumber = 0;
        loseCount = 0;
        betResult = '';
        betAmount = 0;
        return;
    }
    if (loseCount === 0) {
        switch (roundNumber) {
            case 0:
                betAmount = normalBetAmount;
                let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                roundNumber++;
                betResult = 'bear';
                if (GLOBAL_CONFIG.SIMULATION_MODE) {
                    updateSimulationBalance(getSimulationBalance() - getBetAmount() - parseFeeFromCryptoToUsd(transaction.txGasFee));
                }
                await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                return transaction.betExecuted;
            case 1:
                if (prevRoundData.winner === betResult) {
                    betAmount = (normalBetAmount * 1.7 - normalBetAmount) * 0.7;
                    let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                    transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                    roundNumber++;
                    betResult = 'bear';
                } else {
                    loseCount++;
                    martingaleBetAmount = normalBetAmount * 2;
                    betAmount = normalBetAmount * 2;
                    let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                    transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                    roundNumber = 0;
                    betResult = 'bear';
                }
                await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                return transaction.betExecuted;
            case (2 || 3 || 4):
                if (prevRoundData.winner === betResult) {
                    betAmount = betAmount * 1.7 * 0.7;
                    let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                    transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                    roundNumber++;
                    betResult = 'bear';
                    await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                    return transaction.betExecuted;
                } else {
                    winCount = 0;
                    roundNumber = 0;
                    loseCount = 0;
                    betResult = '';
                    betAmount = 0;
                    return;
                }
            default:
                return;
        }
    } else {
        if (winCount === 1) {
            winCount = 0;
            if (prevRoundData.winner === betResult) {
                roundNumber = 0;
                loseCount = 0;
                betResult = '';
                betAmount = 0;
                return;
            } else {
                betAmount = normalBetAmount;
                let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                roundNumber++;
                betResult = 'bear';
                if (GLOBAL_CONFIG.SIMULATION_MODE) {
                    updateSimulationBalance(getSimulationBalance() - getBetAmount() - parseFeeFromCryptoToUsd(transaction.txGasFee));
                }
                await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                return transaction.betExecuted;
            }
        } else {
            if (prevRoundData.winner === betResult) {
                winCount++;
                martingaleBetAmount *= 2;
                betAmount = martingaleBetAmount;
            } else {
                winCount = 0;
                betAmount = normalBetAmount;
            }
            let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
            transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
            roundNumber++;
            betResult = 'bear';
            if (GLOBAL_CONFIG.SIMULATION_MODE) {
                updateSimulationBalance(getSimulationBalance() - getBetAmount() - parseFeeFromCryptoToUsd(transaction.txGasFee));
            }
            await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
            return transaction.betExecuted;
        }
    }

}

/**
 * Converts the bet amount from dollars to crypto, calls the function to place the bet up and saves the transaction data. In case of simulated mode, it updates the fictitious balance
 * @date 4/22/2023 - 3:57:23 PM
 *
 * @async
 * @param {ethers.BigNumber} epoch - round
 * @returns {Boolean} flag indicating the execution of the transaction
 */
const betUpStrategy = async (epoch) => {
    let transaction;
    let prevRoundData = await getRoundData(epoch - 1);
    if (roundNumber > 7) {
        winCount = 0;
        roundNumber = 0;
        loseCount = 0;
        betResult = '';
        betAmount = 0;
        return;
    }
    if (loseCount === 0) {
        switch (roundNumber) {
            case 0:
                betAmount = normalBetAmount;
                let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                roundNumber++;
                betResult = 'bull';
                if (GLOBAL_CONFIG.SIMULATION_MODE) {
                    updateSimulationBalance(getSimulationBalance() - getBetAmount() - parseFeeFromCryptoToUsd(transaction.txGasFee));
                }
                await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                return transaction.betExecuted;
            case 1:
                if (prevRoundData.winner === betResult) {
                    betAmount = (normalBetAmount * 1.7 - normalBetAmount) * 0.7;
                    let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                    transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                    roundNumber++;
                    betResult = 'bull';
                } else {
                    loseCount++;
                    martingaleBetAmount = normalBetAmount * 2;
                    betAmount = normalBetAmount * 2;
                    let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                    transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                    roundNumber = 0;
                    betResult = 'bull';
                }
                await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                return transaction.betExecuted;
            case (2 || 3 || 4):
                if (prevRoundData.winner === betResult) {
                    betAmount = betAmount * 1.7 * 0.7;
                    let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                    transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                    roundNumber++;
                    betResult = 'bull';
                    await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                    return transaction.betExecuted;
                } else {
                    winCount = 0;
                    roundNumber = 0;
                    loseCount = 0;
                    betResult = '';
                    betAmount = 0;
                    return;
                }
            default:
                return;
        }
    } else {
        if (winCount === 1) {
            winCount = 0;
            if (prevRoundData.winner === betResult) {
                roundNumber = 0;
                loseCount = 0;
                betResult = '';
                betAmount = 0;
                return;
            } else {
                betAmount = normalBetAmount;
                let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
                transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
                roundNumber++;
                betResult = 'bull';
                if (GLOBAL_CONFIG.SIMULATION_MODE) {
                    updateSimulationBalance(getSimulationBalance() - getBetAmount() - parseFeeFromCryptoToUsd(transaction.txGasFee));
                }
                await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
                return transaction.betExecuted;
            }
        } else {
            if (prevRoundData.winner === betResult) {
                winCount++;
                martingaleBetAmount *= 2;
                betAmount = martingaleBetAmount;
            } else {
                winCount = 0;
                betAmount = normalBetAmount;
            }
            let cryptoBetAmount = parseFromUsdToCrypto(betAmount)
            transaction = parseTransactionReceipt(await betDown(cryptoBetAmount, epoch));
            roundNumber++;
            betResult = 'bull';
            if (GLOBAL_CONFIG.SIMULATION_MODE) {
                updateSimulationBalance(getSimulationBalance() - getBetAmount() - parseFeeFromCryptoToUsd(transaction.txGasFee));
            }
            await saveRoundInHistory([{ round: formatUnit(epoch), betAmount: cryptoBetAmount, bet: BET_DOWN, betExecuted: transaction.betExecuted, txGasFee: transaction.txGasFee }]);
            return transaction.betExecuted;
        }
    }
}

/**
 * Check that the incoming passed round can be claimed and that automatic claiming is enabled. If so, it calls the function that executes the claim, if not, it returns a fictitious transaction.
 * @date 4/22/2023 - 3:57:23 PM
 *
 * @async
 * @param {ethers.BigNumber} epoch - round
 * @returns {{ status: Number, txGasFee: Number, transactionExeption: Boolean}} - claim transaction data
 */
const claimStrategy = async (epoch) => {
    if (GLOBAL_CONFIG.CLAIM_REWARDS && await isClaimableRound(epoch)) {
        return await claimRewards([epoch]);
    } else {
        return { status: 0, txGasFee: 0 };
    }
}

/**
 * Parse the transaction receipt from smart contract and calculate the gas fee and if the transaction is OK or KO
 * @date 4/22/2023 - 3:57:23 PM
 *
 * @param {{{ status: Number, gasUsed: Number, effectiveGasPrice: Number, transactionExeption: Boolean}}} txReceipt
 * @returns {{ betExecuted: Boolean; txGasFee: number; }}
 */
const parseTransactionReceipt = (txReceipt) => {
    const betExecuted = txReceipt.status === 1;
    if (txReceipt.transactionExeption) {
        return { betExecuted: betExecuted, txGasFee: 0 };
    } else {
        const gasUsed = formatUnit(txReceipt.gasUsed);
        const effectiveGasPrice = formatUnit(txReceipt.effectiveGasPrice);
        const txGasFee = formatUnit(gasUsed * effectiveGasPrice, "18");
        return { betExecuted: txReceipt.status === 1, txGasFee: txGasFee };
    }
}

module.exports = {
    betDownStrategy,
    betUpStrategy,
    claimStrategy
};