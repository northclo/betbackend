import mongoose from "mongoose";
const { Schema } = mongoose;

const OptionSchema = new Schema(
    {
        name: { 
            type: String, 
            required: true,
            trim: true
        },
        odd: { 
            type: Number, 
            min: 0,
            default: 0
        },
        even: { 
            type: Number, 
            min: 0,
            default: 0
        },
        under: { 
            type: Number, 
            min: 0,
            default: 0
        },
        over: { 
            type: Number, 
            min: 0,
            default: 0
        },
        odd_under: { 
            type: Number, 
            min: 0,
            default: 0
        },
        odd_over: { 
            type: Number, 
            min: 0,
            default: 0
        },
        even_under: { 
            type: Number, 
            min: 0,
            default: 0
        },
        even_over: { 
            type: Number, 
            min: 0,
            default: 0
        },
        match_number1: { 
            type: Number, 
            min: 0,
            default: 0
        },
        match_number2: { 
            type: Number, 
            min: 0,
            default: 0
        },
        match_number3: { 
            type: Number, 
            min: 0,
            default: 0
        },
    },
    { _id: false }
);

const GameSettingSchema = new Schema(
    {
        name: { 
            type: String, 
            required: true,
            trim: true
        },
        activate: { 
            type: Boolean, 
            default: true 
        },
        inactive_message: { 
            type: String, 
            default: '',
            trim: true
        },
        duplicate_betting: { 
            type: Boolean, 
            default: true 
        },
        duplicate_betting_limit: { 
            type: Number, 
            min: 0,
            default: 0
        },
        option: {
            type: [OptionSchema],
            default: []
        }
    },
    { timestamps: true }
);

GameSettingSchema.index({ name: 1 });

const GameSettingModel = mongoose.model("game_setting", GameSettingSchema);

export default GameSettingModel;
