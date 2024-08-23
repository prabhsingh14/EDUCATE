const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

// Controller function to initiate password reset process
exports.resetPasswordToken = async (req, res) => {
	try {
		const email = req.body.email;

		// Check if the user exists with the provided email
		const user = await User.findOne({ email: email });
		
		if (!user) {
			return res.json({
				success: false,
				message: `This Email: ${email} is not Registered With Us`,
			});
		}

		// Generate a secure token for password reset
		const token = crypto.randomBytes(20).toString("hex");

		// Update the user's record with the generated token and expiration time
		const updatedDetails = await User.findOneAndUpdate(
			{ email: email },
			{
				token: token,
				resetPasswordExpires: Date.now() + 3600000, // Token expires in 1 hour
			},
			{ new: true }
		);

		// Create the URL for the password reset link
		const url = `http://localhost:3000/update-password/${token}`;

		// Send the password reset email to the user
		await mailSender(
			email,
			"Reset your password",
			`Your Link for password reset is ${url}.`
		);

		res.json({
			success: true,
			message:
				"Email Sent Successfully, Please Check Your Email to Continue Further",
		});
	} catch (error) {
		// Handle errors and respond with appropriate message
		return res.json({
			error: error.message,
			success: false,
			message: `Some Error in Sending the Reset Message`,
		});
	}
};

// Controller function to handle the password reset request
exports.resetPassword = async (req, res) => {
	try {
		const { password, confirmPassword, token } = req.body;

		// Validate that the provided passwords match
		if (confirmPassword !== password) {
			return res.json({
				success: false,
				message: "Password and Confirm Password Does not Match",
			});
		}

		// Find the user with the provided reset token
		const userDetails = await User.findOne({ token: token });
		if (!userDetails) {
			return res.json({
				success: false,
				message: "Token is Invalid",
			});
		}
		
		// Check if the token has expired
		if (!(userDetails.resetPasswordExpires > Date.now())) {
			return res.status(403).json({
				success: false,
				message: `Token is Expired, Please Regenerate Your Token`,
			});
		}
		
		// Hash the new password before saving it
		const encryptedPassword = await bcrypt.hash(password, 10);
		
		// Update the user's password in the database
		await User.findOneAndUpdate(
			{ token: token },
			{ password: encryptedPassword },
			{ new: true }
		);
		
		res.json({
			success: true,
			message: `Password Reset Successful`,
		});
	} catch (error) {
		// Handle errors and respond with appropriate message
		return res.json({
			error: error.message,
			success: false,
			message: `Some Error in Updating the Password`,
		});
	}
};
