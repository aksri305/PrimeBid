import cron from "node-cron";
import { Auction } from "../models/auctionSchema.js";
import { User } from "../models/userSchema.js";
import { Bid } from "../models/bidSchema.js";
import { sendEmail } from "../utils/sendEmail.js";
import { calculateCommission } from "../controllers/commissionController.js";

export const endedAuctionCron = () => {
  cron.schedule("*/1 * * * *", async () => {
    const now = new Date();
    console.log("Cron for ended auctions running...");
    const endedAuctions = await Auction.find({
      endTime: { $lt: now },
      commissionCalculated: false,
    });
    
    for (const auction of endedAuctions) {
      try {
        console.log(`Processing auction: ${auction.title}`);
        
        // Calculate commission
        const commissionAmount = await calculateCommission(auction._id);
        auction.commissionCalculated = true;
        
        // Find the highest bidder
        const highestBidder = await Bid.findOne({
          auctionItem: auction._id,
          amount: auction.currentBid,
        });
        
        // Get the auctioneer details
        const auctioneer = await User.findById(auction.createdBy);
        
        // Update auctioneer unpaid commission
        auctioneer.unpaidCommission = commissionAmount;
        
        if (highestBidder) {
          // Update auction with the highest bidder details
          auction.highestBidder = highestBidder.bidder.id;
          await auction.save();

          const bidder = await User.findById(highestBidder.bidder.id);
          console.log("Highest Bidder:", bidder);

          if (bidder && bidder.email) {
            // Update bidder: Increment money spent and auctions won
            const updatedBidder = await User.findByIdAndUpdate(
              bidder._id,
              {
                $inc: {
                  moneySpent: highestBidder.amount, // Increment amount spent
                  auctionsWon: 1, // Increment auctions won
                },
              },
              { new: true }
            );
            console.log("Updated Bidder:", updatedBidder);

            // Update auctioneer: Increment unpaid commission
            const updatedAuctioneer = await User.findByIdAndUpdate(
              auctioneer._id,
              {
                $inc: {
                  unpaidCommission: commissionAmount,
                },
              },
              { new: true }
            );
            console.log("Updated Auctioneer:", updatedAuctioneer);

            // Construct email details
            const subject = `Congratulations! You won the auction for ${auction.title}`;
            const message = `
              Dear ${bidder.userName}, \n\n
              Congratulations! You have won the auction for ${auction.title}. \n\n
              Before proceeding for payment contact your auctioneer via your auctioneer email: ${auctioneer.email} \n\n
              Please complete your payment using one of the following methods:\n\n
              1. **Bank Transfer**:\n- Account Name: ${auctioneer.paymentMethods.bankTransfer.bankAccountName}\n- Account Number: ${auctioneer.paymentMethods.bankTransfer.bankAccountNumber}\n- Bank: ${auctioneer.paymentMethods.bankTransfer.bankName}\n\n
              2. **Razorpay**:\n- You can send payment via Razorpay: ${auctioneer.paymentMethods.razorpay.razorpayAccountNumber}\n\n
              3. **PayPal**:\n- Send payment to: ${auctioneer.paymentMethods.paypal.paypalEmail}\n\n
              4. **Cash on Delivery (COD)**:\n- If you prefer COD, you must pay 20% of the total amount upfront before delivery.\n- To pay the 20% upfront, use any of the above methods.\n- The remaining 80% will be paid upon delivery.\n\n
              Please ensure your payment is completed by [Payment Due Date]. Once we confirm the payment, the item will be shipped to you.\n\n
              Best regards,\nZeeshu Auction Team
            `;

            // Log that email is about to be sent
            console.log(`SENDING EMAIL TO HIGHEST BIDDER: ${bidder.email}`);

            // Send email
            await sendEmail({ email: bidder.email, subject, message });
            console.log("SUCCESSFULLY SENT EMAIL TO HIGHEST BIDDER");
          } else {
            console.log("Bidder email not found or invalid.");
          }
        } else {
          await auction.save();
          console.log(`No highest bidder found for auction: ${auction.title}`);
        }
      } catch (error) {
        console.error(`Error processing auction ${auction.title}:`, error);
      }
    }
  });
};
