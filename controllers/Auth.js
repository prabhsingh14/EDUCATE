const bcrypt = require("bcrypt"); // Library for hashing passwords
const User = require("../models/User"); // User model
const OTP = require("../models/OTP"); // OTP model
const jwt = require("jsonwebtoken"); // Library for handling JSON Web Tokens (JWT)
const otpGenerator = require("otp-generator"); // Library for generating OTPs
const mailSender = require("../utils/mailSender"); // Utility for sending emails
const { passwordUpdated } = require("../mail/templates/passwordUpdate"); // Email template for password update
const Profile = require("../models/Profile"); // Profile model
require("dotenv").config(); // Load environment variables

// Signup Controller for new users
exports.signup = async (req, res) => {
	try {
		// Extract data from the request body
		const {
			firstName,
			lastName,
			email,
			password,
			confirmPassword,
			accountType,
			contactNumber,
			otp,
		} = req.body;

		// Check if all required fields are present
		if (!firstName || !lastName || !email || !password || !confirmPassword || !otp) {
			return res.status(403).send({
				success: false,
				message: "All Fields are required",
			});
		}

		// Check if password and confirm password match
		if (password !== confirmPassword) {
			return res.status(400).json({
				success: false,
				message: "Password and Confirm Password do not match. Please try again.",
			});
		}

		// Check if the user already exists in the database
		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({
				success: false,
				message: "User already exists. Please login to continue.",
			});
		}

		// Find the most recent OTP for the email
		const response = await OTP.find({ email }).sort({ createdAt: -1 }).limit(1);
		if (response.length === 0) {
			return res.status(400).json({
				success: false,
				message: "No OTP found for this email. Please request a new one.",
			});
		} else if (otp !== response[0].otp) {
			return res.status(400).json({
				success: false,
				message: "The OTP is not valid",
			});
		}

		// Hash the user's password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Set the approval status based on the account type
		let approved = "Instructor";
		approved === "Instructor" ? false : true; // Instructors need approval, others are approved automatically

		// Create the user's profile with default values
		const profileDetails = await Profile.create({
			gender: null,
			dateOfBirth: null,
			about: null,
			contactNumber: null,
		});

		// Create the user document in the database
		const user = await User.create({
			firstName,
			lastName,
			email,
			contactNumber,
			password: hashedPassword,
			accountType: accountType,
			approved: approved,
			additionalDetails: profileDetails._id, // Link the profile details to the user
			image: `https://api.dicebear.com/5.x/initials/svg?seed=${firstName} ${lastName}`, // Generate a profile image
		});

		// Send a success response with the newly created user details
		return res.status(200).json({
			success: true,
			user,
			message: "User registered successfully",
		});
	} catch (error) {
		// Log the error and send a failure response
		console.error(error);
		return res.status(500).json({
			success: false,
			message: "User cannot be registered. Please try again.",
		});
	}
};

// Login controller for authenticating users
exports.login = async (req, res) => {
	try {
		// Extract email and password from the request body
		const { email, password } = req.body;

		// Check if email or password is missing
		if (!email || !password) {
			return res.status(400).json({
				success: false,
				message: `Please fill in all required fields.`,
			});
		}

		// Find user with the provided email
		const user = await User.findOne({ email }).populate("additionalDetails");

		// If user not found, return an error
		if (!user) {
			return res.status(401).json({
				success: false,
				message: `Invalid credentials. Please try again.`,
			});
		}

		// Compare the provided password with the hashed password stored in the database
		if (await bcrypt.compare(password, user.password)) {
			// Generate a JWT token for the user
			const token = jwt.sign(
				{ email: user.email, id: user._id, accountType: user.accountType },
				process.env.JWT_SECRET,
				{
					expiresIn: "24h", // Token expires in 24 hours
				}
			);

			// Store the token in the user document (optional)
			user.token = token;
			user.password = undefined; // Remove password from the response

			// Set a cookie with the token and return a success response
			const options = {
				expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days
				httpOnly: true, // Cookie is accessible only by the web server
			};
			res.cookie("token", token, options).status(200).json({
				success: true,
				token,
				user,
				message: `User Login Success`,
			});
		} else {
			// If password doesn't match, return an error
			return res.status(401).json({
				success: false,
				message: `Password is incorrect`,
			});
		}
	} catch (error) {
		// Log the error and send a failure response
		console.error(error);
		return res.status(500).json({
			success: false,
			message: `Login Failure Please Try Again`,
		});
	}
};

// Send OTP For Email Verification - for Signup
exports.sendotp = async (req, res) => {
	try {
		// Extract email from the request body
		const { email } = req.body;

		// Check if the user is already registered
		const checkUserPresent = await User.findOne({ email });
		if (checkUserPresent) {
			return res.status(409).json({
				success: false,
				message: `User is Already Registered`,
			});
		}

		// Generate a 6-digit numeric OTP
		var otp = otpGenerator.generate(6, {
			upperCaseAlphabets: false,
			lowerCaseAlphabets: false,
			specialChars: false,
		});
		
		// Ensure the generated OTP is unique
		const result = await OTP.findOne({ otp: otp });
		while (result) {
			otp = otpGenerator.generate(6, {
				upperCaseAlphabets: false,
			});
			result = await OTP.findOne({ otp: otp });
		}
		
		// Save the OTP to the database
		const otpPayload = { email, otp };
		const otpBody = await OTP.create(otpPayload);

		// Send the OTP to the client (for testing, in production this would be sent via email)
		res.status(200).json({
			success: true,
			message: `OTP Sent Successfully`,
			otp, // For testing purposes, do not include this in production
		});
		
	} catch (error) {
		// Log the error and send a failure response
		console.log(error.message);
		return res.status(500).json({ 
			success: false, 
			error: error.message 
		});
	}
};

// Controller for Changing Password
exports.changePassword = async (req, res) => {
	try {
		// Fetch user details using the ID from the request
		const userDetails = await User.findById(req.user.id);

		// Extract old and new passwords from request body
		const { oldPassword, newPassword, confirmNewPassword } = req.body;

		// Check if the old password matches the stored password
		const isPasswordMatch = await bcrypt.compare(oldPassword, userDetails.password);
		if (!isPasswordMatch) {
			return res.status(401).json({ 
				success: false, 
				message: "The old password is incorrect" 
			});
		}

		// Validate that the new password and confirm password match
		if (newPassword !== confirmNewPassword) {
			return res.status(400).json({
				success: false,
				message: "The new password and confirm password do not match",
			});
		}

		// Hash the new password
		const encryptedPassword = await bcrypt.hash(newPassword, 10);

		// Update the user's password in the database
		const updatedUserDetails = await User.findByIdAndUpdate(
			req.user.id,
			{ password: encryptedPassword },
			{ new: true } // Return the updated document
		);

		// Send a notification email about the password change
		try {
			await mailSender(
				updatedUserDetails.email,
				passwordUpdated(
					updatedUserDetails.email,
					`Password updated successfully for ${updatedUserDetails.firstName} ${updatedUserDetails.lastName}`
				)
			);
		} catch (error) {
			console.error("Error occurred while sending email:", error);
			return res.status(500).json({
				success: false,
				message: "Error occurred while sending the email",
				error: error.message,
			});
		}

		// Respond with success
		return res.status(200).json({ 
			success: true, 
			message: "Password updated successfully" 
		});
	} catch (error) {
		// Handle any other errors that occur
		console.error("Error occurred while updating password:", error);
		return res.status(500).json({
			success: false,
			message: "Error occurred while updating the password",
			error: error.message,
		});
	}
};
