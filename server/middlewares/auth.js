const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const User = require("../models/User");

// middleware to authenticate user requests
exports.auth = async (req, res, next) => {
	try {
		// Extracting JWT from the request object
		const token =
			req.cookies.token ||
			req.body.token ||
			req.header("Authorization").replace("Bearer ", "");
		
		if (!token) {
			return res.status(401).json({ 
                success: false, 
                message: `JWT token is missing`,
            });
		}

		try {
			// Verifying the JWT using the secret key stored in environment variables
			const decode = await jwt.verify(token, process.env.JWT_SECRET);
			// Storing the decoded JWT payload in the request object for further use
			req.user = decode;
		} catch (error) {
			return res.status(401).json({ 
                success: false, 
                message: "Token is invalid", 
            });
		}

		// If JWT is valid, move on to the next middleware or request handler
		next();
	} catch (error) {
		return res.status(401).json({
			success: false,
			message: `Something Went Wrong While Validating the Token`,
		});
	}
};

// middleware to check if the user is a student
exports.isStudent = async (req, res, next) => {
	try {
		const userDetails = await User.findOne({ email: req.user.email });

		if (userDetails.accountType !== "Student") {
			return res.status(401).json({
				success: false,
				message: "This is a Protected Route for Students",
			});
		}
		next();
	} catch (error) {
		return res.status(500).json({ 
            success: false, 
            message: `User Role Can't be Verified` 
        });
	}
};

// middleware to check if the user is an admin
exports.isAdmin = async (req, res, next) => {
	try {
		const userDetails = await User.findOne({ email: req.user.email });

		if (userDetails.accountType !== "Admin") {
			return res.status(401).json({
				success: false,
				message: "This is a Protected Route for Admin",
			});
		}
		next();
	} catch (error) {
		return res.status(500).json({ 
            success: false, 
            message: `User Role Can't be Verified`,
        });
	}
};

// middleware to check if the user is an instructor
exports.isInstructor = async (req, res, next) => {
	try {
		const userDetails = await User.findOne({ email: req.user.email });

		if (userDetails.accountType !== "Instructor") {
			return res.status(401).json({
				success: false,
				message: "This is a Protected Route for Instructor",
			});
		}
		next();
	} catch (error) {
		return res.status(500).json({ 
            success: false, 
            message: `User Role Can't be Verified` 
        });
	}
};