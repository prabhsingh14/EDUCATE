const mongoose = require("mongoose");

const ratingAndReviewSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: "user",
	},

	rating: {
		type: Number,
		required: true,
	},
	
	review: {
		type: String,
		required: true,
	},
	
	course: {
		type: mongoose.Schema.Types.ObjectId,
		required: true,
		ref: "Course",
		index: true, // to make the search faster
	},
});

module.exports = mongoose.model("RatingAndReview", ratingAndReviewSchema);