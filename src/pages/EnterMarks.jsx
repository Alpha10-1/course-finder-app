import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const EnterMarks = () => {
  const [marks, setMarks] = useState({
    English: '',
    Mathematics: '',
    PhysicalSciences: '',
    LifeSciences: '',
    Accounting: '',
    BusinessStudies: '',
    Economics: '',
    History: '',
    Geography: '',
    LifeOrientation: '',
    Other1: '',
    Other2: '',
  });

  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setMarks((prevMarks) => ({
      ...prevMarks,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const subjectsArray = Object.keys(marks)
      .filter((subject) => marks[subject] !== '')
      .map((subject) => ({
        name: subject,
        mark: parseInt(marks[subject], 10),
      }));

    console.log('✅ Submitting subjects array:', subjectsArray);

    navigate('/results', { state: { subjects: subjectsArray } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white shadow-lg rounded-2xl p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold mb-6 text-center text-blue-700">
          Enter Your Marks
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          {Object.keys(marks).map((subject) => (
            <div key={subject}>
              <label className="block font-medium text-gray-700 mb-1">
                {subject.replace(/([A-Z])/g, ' $1').trim()}:
              </label>
              <input
                type="number"
                name={subject}
                value={marks[subject]}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                min="0"
                max="100"
                required={subject === 'English'}
              />
            </div>
          ))}
          <button
            type="submit"
            className="w-full bg-blue-600 text-white text-lg font-semibold px-4 py-3 rounded-xl hover:bg-blue-700 transition duration-200"
          >
            See Results
          </button>
        </form>
      </div>
    </div>
  );
};

export default EnterMarks;