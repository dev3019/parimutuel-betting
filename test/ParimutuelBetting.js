const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ParimutuelBetting Contract", function () {
    let ParimutuelBetting;
    let betting;
    let owner, admin, user1, user2, user3;
    
    beforeEach(async function () {
        ParimutuelBetting = await ethers.getContractFactory("ParimutuelBetting");
        [owner, admin, user1, user2, user3] = await ethers.getSigners();

        // Deploy contract
        betting = await ParimutuelBetting.deploy();
        // await betting.deployed();

        // Add admin
        await betting.addAdmin(admin.address);
    });

    describe("Admin functionalities", function () {
        it("should allow the owner to add and remove admins", async function () {
            await betting.addAdmin(user1.address);
            expect(await betting.admins(user1.address)).to.be.true;

            await betting.removeAdmin(user1.address);
            expect(await betting.admins(user1.address)).to.be.false;
        });

        it("should not allow non-owners to add/remove admins", async function () {
            await expect(betting.connect(user1).addAdmin(user2.address)).to.be.revertedWith("Only owner can perform this action");
            await expect(betting.connect(user1).removeAdmin(admin.address)).to.be.revertedWith("Only owner can perform this action");
        });
    });

    describe("Prediction functionalities", function () {
        it("should allow admins to create predictions", async function () {
            const options = ["Option 1", "Option 2"];
            const endBidTime = (await ethers.provider.getBlock("latest")).timestamp + 3600; // 1 hour from now

            await betting.connect(admin).createPrediction("Prediction Title", "Prediction Description", options, endBidTime);

            const prediction = await betting.predictions(0);
            // Accessing the options array properly
            const predictionOptions = await betting.getPredictionOptions(0);
            expect(prediction.title).to.equal("Prediction Title");
            expect(prediction.description).to.equal("Prediction Description");
            expect(predictionOptions).to.deep.equal(options);
            expect(prediction.endBidTime).to.equal(endBidTime);
            expect(prediction.isActive).to.be.true;
        });

        it("should not allow non-admins to create predictions", async function () {
            const options = ["Option 1", "Option 2"];
            const endBidTime = (await ethers.provider.getBlock("latest")).timestamp + 3600; // 1 hour from now

            await expect(betting.connect(user1).createPrediction("Prediction Title", "Prediction Description", options, endBidTime)).to.be.revertedWith("Only admin can perform this action");
        });

        it("should allow users to place bets", async function () {
            const options = ["Option 1", "Option 2"];
            const endBidTime = (await ethers.provider.getBlock("latest")).timestamp + 3600; // 1 hour from now
            await betting.connect(admin).createPrediction("Prediction Title", "Prediction Description", options, endBidTime);

            // User 1 places a bet
            await betting.connect(user1).placeBet(0, "Option 1", { value: ethers.parseEther("1.0") });
            const totalBets = await betting.getTotalBets(0, "Option 1")
            expect(totalBets).to.equal(ethers.parseEther("1.0"));
            const userBet = await betting.getUserBet(0, user1.address, "Option 1")
            expect(userBet).to.equal(ethers.parseEther("1.0"));
        });

        it("should not allow betting after the bidding time has ended", async function () {
            const options = ["Option 1", "Option 2"];
            const endBidTime = (await ethers.provider.getBlock("latest")).timestamp + 3; // 1 second from now
            await betting.connect(admin).createPrediction("Prediction Title", "Prediction Description", options, endBidTime);

            // Move time forward to simulate time passing
            await new Promise(resolve => setTimeout(resolve, 5000));

            await expect(betting.connect(user1).placeBet(0, "Option 1", { value: ethers.parseEther("1.0") })).to.be.revertedWith("Cannot place bet after bidding time has ended");
        });

        it("should allow the admin to end the prediction and distribute winnings for option 1", async function () {
            const options = ["Option 1", "Option 2"];

            // record users balances before 
            const user1BalanceBefore = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user1.address)));
            const user2BalanceBefore = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user2.address)));
            const user3BalanceBefore = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user3.address)));

            const endBidTime = (await ethers.provider.getBlock("latest")).timestamp + 5; // 5 second from now
            await betting.connect(admin).createPrediction("Prediction Title", "Prediction Description", options, endBidTime);

            // User 1 places a bet
            await betting.connect(user1).placeBet(0, "Option 1", { value: ethers.parseEther("1.0") });
            // User 2 places a bet
            await betting.connect(user2).placeBet(0, "Option 2", { value: ethers.parseEther("2.0") });
            // User 2 places a bet
            await betting.connect(user3).placeBet(0, "Option 2", { value: ethers.parseEther("3.0") });

            // Error expected in early closing of prediction
            await expect(betting.connect(admin).endPrediction(0, "Option 1")).to.be.revertedWith("Prediction has not ended yet");

            // Move time forward to simulate time passing
            await new Promise(resolve => setTimeout(resolve, 3000));

            // End the prediction with "Option 1" as the winner
            await betting.connect(admin).endPrediction(0, "Option 1")

            // Check user 1's payout
            const user1BalanceAfter = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user1.address)));
            expect(user1BalanceAfter-user1BalanceBefore).to.be.closeTo(5, 0.01); // Adjust for gas fees

            // Check user 2's payout
            const user2BalanceAfter = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user2.address)));
            expect(user2BalanceAfter-user2BalanceBefore).to.be.closeTo(-2, 0.01); // Lost bet of 2 ether

            // Check user 3's payout
            const user3BalanceAfter = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user3.address)));
            expect(user3BalanceAfter-user3BalanceBefore).to.be.closeTo(-3, 0.01); // Lost bet of 3 ether
        });

        it("should allow the admin to end the prediction and distribute winnings for option 2", async function () {
            const options = ["Option 1", "Option 2"];

            // record users balances before 
            const user1BalanceBefore = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user1.address)));
            const user2BalanceBefore = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user2.address)));
            const user3BalanceBefore = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user3.address)));

            const endBidTime = (await ethers.provider.getBlock("latest")).timestamp + 5; // 5 second from now
            await betting.connect(admin).createPrediction("Prediction Title", "Prediction Description", options, endBidTime);

            // User 1 places a bet
            await betting.connect(user1).placeBet(0, "Option 1", { value: ethers.parseEther("1.0") });
            // User 2 places a bet
            await betting.connect(user2).placeBet(0, "Option 2", { value: ethers.parseEther("2.0") });
            // User 2 places a bet
            await betting.connect(user3).placeBet(0, "Option 2", { value: ethers.parseEther("3.0") });

            // Error expected in early closing of prediction
            await expect(betting.connect(admin).endPrediction(0, "Option 2")).to.be.revertedWith("Prediction has not ended yet");

            // Move time forward to simulate time passing
            await new Promise(resolve => setTimeout(resolve, 3000));

            // End the prediction with "Option 1" as the winner
            await betting.connect(admin).endPrediction(0, "Option 2")

            // Check user 1's payout
            const user1BalanceAfter = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user1.address)));
            expect(user1BalanceAfter-user1BalanceBefore).to.be.closeTo(-1, 0.01); // Adjust for gas fees

            // Check user 2's payout
            const user2BalanceAfter = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user2.address)));
            expect(user2BalanceAfter-user2BalanceBefore).to.be.closeTo(0.4, 0.01); // Lost bet of 2 ether
            
            // Check user 3's payout
            const user3BalanceAfter = parseFloat(ethers.formatEther(await ethers.provider.getBalance(user3.address)));
            expect(user3BalanceAfter-user3BalanceBefore).to.be.closeTo(0.6, 0.01); // Lost bet of 3 ether
        });
    });
});
