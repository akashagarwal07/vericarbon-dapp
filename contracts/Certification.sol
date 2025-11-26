// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IVeirCarbonRoles
 * @dev CORRECTED Interface.
 * Points to the automatic 'verifierCount' getter, not 'getVerifierCount'.
 */
interface IVeirCarbonRoles {
    function isIssuer(address _account) external view returns (bool);
    function isVerifier(address _account) external view returns (bool);
    // --- CORRECTED ---
    function verifierCount() external view returns (uint256);
}

/**
 * @title IVeirCarbonToken
 * @dev Interface for the Token contract. (No changes)
 */
interface IVeirCarbonToken {
    function issueCredits(
        address _to,
        uint256 _amount,
        string memory _uri,
        uint256 _durationInDays
    ) external returns (uint256);
}

/**
 * @title Certification
 * @dev CORRECTED version.
 * Calls the correct 'verifierCount()' function.
 */
contract Certification {

    IVeirCarbonRoles public rolesContract;
    IVeirCarbonToken public tokenContract;
    
    uint256 private _projectIdCounter;

    struct ProjectProposal {
        address issuer;          
        address company;         
        uint256 amount;            
        string uri;              
        uint256 durationInDays;    
        uint256 approvalCount;     
        bool isMinted;           
        mapping(address => bool) hasSigned; 
    }

    mapping(uint256 => ProjectProposal) public projectProposals;

    event ProjectProposed(
        uint256 indexed projectId,
        address indexed issuer,
        address indexed company,
        uint256 amount
    );
    event ProjectApproved(uint256 indexed projectId, address indexed verifier);
    event ProjectMinted(uint256 indexed projectId, uint256 indexed tokenId);

    constructor(
        address _rolesContractAddress,
        address _tokenContractAddress
    ) {
        rolesContract = IVeirCarbonRoles(_rolesContractAddress);
        tokenContract = IVeirCarbonToken(_tokenContractAddress);
    }

    function proposeProject(
        address _company,
        uint256 _amount,
        string memory _uri,
        uint256 _durationInDays
    ) public {
        require(rolesContract.isIssuer(msg.sender), "Caller is not an issuer");

        uint256 projectId = ++_projectIdCounter;
        ProjectProposal storage proposal = projectProposals[projectId];
        proposal.issuer = msg.sender;
        proposal.company = _company;
        proposal.amount = _amount;
        proposal.uri = _uri;
        proposal.durationInDays = _durationInDays;
        
        emit ProjectProposed(projectId, msg.sender, _company, _amount);
    }

    function approveProject(uint256 _projectId) public {
        require(rolesContract.isVerifier(msg.sender), "Caller is not a verifier");

        ProjectProposal storage proposal = projectProposals[_projectId];

        require(proposal.issuer != address(0), "Project does not exist");
        require(!proposal.isMinted, "Project has already been minted");
        require(!proposal.hasSigned[msg.sender], "Verifier has already signed");

        proposal.hasSigned[msg.sender] = true;
        proposal.approvalCount++;

        emit ProjectApproved(_projectId, msg.sender);
    }

    function executeProjectMint(uint256 _projectId) public {
        ProjectProposal storage proposal = projectProposals[_projectId];

        // --- CORRECTED: 51% Consensus Logic ---
        uint256 totalVerifiers = rolesContract.verifierCount(); // Calls the automatic getter
        require(totalVerifiers > 0, "No verifiers in system");
        
        require(
            proposal.approvalCount * 2 > totalVerifiers,
            "Project does not have 51% consensus"
        );
        // --- End of Corrected Logic ---

        require(proposal.issuer != address(0), "Project does not exist");
        require(!proposal.isMinted, "Project has already been minted");

        proposal.isMinted = true;

        uint256 newTokenId = tokenContract.issueCredits(
            proposal.company,
            proposal.amount,
            proposal.uri,
            proposal.durationInDays
        );

        emit ProjectMinted(_projectId, newTokenId);
    }
}