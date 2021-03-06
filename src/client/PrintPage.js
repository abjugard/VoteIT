var React = require('react');
var _ = require('lodash');

const formatCode = code => _.chunk(code, 3).map(c => c.join('')).join('-');

const PrintPage = ({ codes }) => (
    <div className="print-wrapper">
        {_.chunk(codes, 8).map((codes8, index) => (
            <div key={index}>
                {codes8.map((userCodes, index) => (
                    <table className="code-table" key={index}>
                        <tbody>
                            {userCodes.map((code, index) => (
                                <tr key={index}>
                                    <td className="index">{index + 1}</td>
                                    <td className="code">{formatCode(code)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ))}
                <div className="whitespace-block">This space is intentionally left blank</div>
            </div>
        ))}
    </div>
);


module.exports = PrintPage;
